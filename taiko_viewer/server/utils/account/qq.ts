import { createError } from "h3";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { type DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { createCode, ensureNonEmpty, sendMailCode, sha256, toIso } from "../../internal/account/shared";
import type { BindingReadDb } from "../../internal/account/binding-read.ts";

export type QqBindingRow = {
    id: number;
    user_id: number;
    qq_number: string;
    status: "pending" | "active" | "removed";
    verify_code_hash: string | null;
    verify_code_expires_at: string | null;
    verify_attempts: number;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
};

export type QqBindingSummary = {
    qqNumber: string;
    status: "pending" | "active" | "removed";
    verifiedAt: string | null;
    createdAt: string;
};

const QQ_VERIFY_TTL_MS = 1000 * 60 * 10; // 10 minutes
const QQ_SEND_COOLDOWN_MS = 60 * 1000;
const QQ_MAX_VERIFY_ATTEMPTS = 5;

const normalizeQqNumber = (value: unknown) => {
    return String(value || "").trim();
};

const isValidQqNumber = (value: string) => /^[1-9]\d{4,14}$/.test(value);

export const getQqBinding = async (userId: number, suppliedDb?: BindingReadDb): Promise<QqBindingSummary | null> => {
    await ensureAccountSchema();
    const db = suppliedDb || getAccountDb();
    const [rows] = await db.execute<DbRow<QqBindingRow>[]>(
        "SELECT * FROM web_user_qq_bindings WHERE user_id = ? AND status IN ('pending', 'active') ORDER BY status = 'active' DESC, created_at DESC LIMIT 1",
        [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
        qqNumber: row.qq_number,
        status: row.status,
        verifiedAt: row.verified_at ? toIso(row.verified_at) : null,
        createdAt: toIso(row.created_at)
    };
};

export const startQqBinding = async (userId: number, qqNumberInput: unknown) => {
    await ensureAccountSchema();
    const qqNumber = normalizeQqNumber(qqNumberInput);
    ensureNonEmpty(qqNumber, "请输入 QQ 号");
    if (!isValidQqNumber(qqNumber)) {
        throw createError({ statusCode: 400, statusMessage: "QQ 号格式不正确" });
    }

    const db = getAccountDb();

    const [qqRows] = await db.execute<DbRow<QqBindingRow>[]>(
        "SELECT * FROM web_user_qq_bindings WHERE qq_number = ? LIMIT 1",
        [qqNumber]
    );
    const qqBinding = qqRows[0];
    if (qqBinding?.status === "active" && qqBinding.user_id !== userId) {
        throw createError({ statusCode: 409, statusMessage: "该 QQ 号已被其他账号绑定" });
    }
    if (qqBinding?.status === "pending" && qqBinding.user_id !== userId) {
        throw createError({ statusCode: 409, statusMessage: "该 QQ 号正在其他账号中验证" });
    }

    const [userRows] = await db.execute<DbRow<QqBindingRow>[]>(
        "SELECT * FROM web_user_qq_bindings WHERE user_id = ? LIMIT 1",
        [userId]
    );
    const userBinding = userRows[0];
    if (userBinding?.status === "active") {
        throw createError({
            statusCode: 409,
            statusMessage: "您已绑定 QQ 号，请先解绑后再绑定新号"
        });
    }
    if (userBinding?.status === "pending") {
        const lastSent = new Date(userBinding.updated_at).getTime();
        if (userBinding.qq_number === qqNumber && Date.now() - lastSent < QQ_SEND_COOLDOWN_MS) {
            throw createError({ statusCode: 429, statusMessage: "验证码发送过于频繁，请稍后再试" });
        }
    }

    const code = createCode();
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + QQ_VERIFY_TTL_MS);

    const targetEmail = `${qqNumber}@qq.com`;
    if (userBinding) {
        if (qqBinding?.status === "removed" && qqBinding.id !== userBinding.id) {
            await db.execute("DELETE FROM web_user_qq_bindings WHERE id = ? AND status = 'removed'", [qqBinding.id]);
        }
        await db.execute(
            `UPDATE web_user_qq_bindings
             SET qq_number = ?, status = 'pending', verify_code_hash = ?,
                 verify_code_expires_at = ?, verify_attempts = 0, verified_at = NULL
             WHERE id = ?`,
            [qqNumber, codeHash, expiresAt, userBinding.id]
        );
    } else if (qqBinding?.status === "removed") {
        await db.execute(
            `UPDATE web_user_qq_bindings
             SET user_id = ?, status = 'pending', verify_code_hash = ?,
                 verify_code_expires_at = ?, verify_attempts = 0, verified_at = NULL
             WHERE id = ?`,
            [userId, codeHash, expiresAt, qqBinding.id]
        );
    } else {
        await db.execute(
            `INSERT INTO web_user_qq_bindings
              (user_id, qq_number, status, verify_code_hash, verify_code_expires_at)
             VALUES (?, ?, 'pending', ?, ?)`,
            [userId, qqNumber, codeHash, expiresAt]
        );
    }

    try {
        await sendMailCode(targetEmail, code, "qq_bind");
    } catch (error) {
        await db.execute(
            "UPDATE web_user_qq_bindings SET status = 'removed', verify_code_hash = NULL, verify_code_expires_at = NULL WHERE user_id = ? AND status = 'pending'",
            [userId]
        );
        throw createError({ statusCode: 502, statusMessage: "验证码邮件发送失败，请稍后再试", cause: error });
    }

    return {
        qqNumber,
        expiresAt: toIso(expiresAt),
        message: `验证码已发送至 ${qqNumber}@qq.com，10 分钟内有效`
    };
};

type LegacyBindRow = RowDataPacket & { id: string; source: string; is_current: number };
type OwnerRow = RowDataPacket & { user_id: number };

const migrateLegacyQqBindings = async (connection: PoolConnection, userId: number, qqNumber: string) => {
    const identityKeys = [qqNumber, `onebot_v11:${qqNumber}`];
    const [legacyRows] = await connection.execute<LegacyBindRow[]>(
        `SELECT id, source, is_current FROM bind
         WHERE qq IN (?, ?) AND source <> 'manual'
         ORDER BY is_current DESC, slot_index ASC, row_id ASC`,
        identityKeys
    );
    let migratedCount = 0;
    let skippedCount = 0;
    const [existingCurrentRows] = await connection.execute(
        "SELECT id FROM web_taiko_bindings WHERE user_id = ? AND is_current = 1 LIMIT 1",
        [userId]
    );
    let hasCurrent = Boolean((existingCurrentRows as unknown[]).length);
    for (const legacy of legacyRows) {
        const taikoId = String(legacy.id || "").trim();
        if (!taikoId) continue;
        const [ownerRows] = await connection.execute<OwnerRow[]>(
            "SELECT user_id FROM web_taiko_bindings WHERE taiko_id = ? LIMIT 1",
            [taikoId]
        );
        const owner = ownerRows[0];
        if (owner && Number(owner.user_id) !== userId) {
            skippedCount += 1;
            continue;
        }
        if (!owner) {
            const makeCurrent = !hasCurrent && Number(legacy.is_current || 0) === 1;
            await connection.execute(
                `INSERT INTO web_taiko_bindings
                  (user_id, taiko_id, source, is_current, verified_title, verified_titleplate_id)
                 VALUES (?, ?, ?, ?, NULL, NULL)`,
                [userId, taikoId, legacy.source === "hiroba" ? "hiroba" : "wahlap", makeCurrent ? 1 : 0]
            );
            hasCurrent ||= makeCurrent;
            migratedCount += 1;
        }
    }
    if (migratedCount > 0 && !hasCurrent) {
        const [currentRows] = await connection.execute(
            "SELECT id FROM web_taiko_bindings WHERE user_id = ? AND is_current = 1 LIMIT 1",
            [userId]
        );
        if (!(currentRows as unknown[]).length) {
            await connection.execute(
                "UPDATE web_taiko_bindings SET is_current = 1 WHERE user_id = ? ORDER BY id ASC LIMIT 1",
                [userId]
            );
        }
    }
    return { migratedCount, skippedCount };
};

export const confirmQqBinding = async (userId: number, codeInput: unknown) => {
    await ensureAccountSchema();
    const code = String(codeInput || "").trim();
    ensureNonEmpty(code, "请输入验证码");

    const db = getAccountDb();
    const codeHash = sha256(code);

    const [rows] = await db.execute<DbRow<QqBindingRow>[]>(
        `SELECT * FROM web_user_qq_bindings
     WHERE user_id = ? AND status = 'pending'
       AND verify_code_expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
        [userId]
    );
    const row = rows[0];
    if (!row || Number(row.verify_attempts || 0) >= QQ_MAX_VERIFY_ATTEMPTS) {
        throw createError({ statusCode: 400, statusMessage: "验证码错误或已失效" });
    }
    if (row.verify_code_hash !== codeHash) {
        await db.execute("UPDATE web_user_qq_bindings SET verify_attempts = verify_attempts + 1 WHERE id = ?", [row.id]);
        throw createError({ statusCode: 400, statusMessage: "验证码错误或已失效" });
    }

    const connection = await db.getConnection();
    let migration = { migratedCount: 0, skippedCount: 0 };
    try {
        await connection.beginTransaction();
        await connection.execute(
            `UPDATE web_user_qq_bindings
             SET status = 'active', verify_code_hash = NULL, verify_code_expires_at = NULL,
                 verify_attempts = 0, verified_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [row.id]
        );
        migration = await migrateLegacyQqBindings(connection, userId, row.qq_number);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return {
        qqNumber: row.qq_number,
        status: "active" as const,
        ...migration,
        message: migration.migratedCount
            ? `QQ ${row.qq_number} 绑定成功，已迁移 ${migration.migratedCount} 个鼓众 ID`
            : `QQ ${row.qq_number} 绑定成功`
    };
};

export const removeQqBinding = async (userId: number) => {
    await ensureAccountSchema();
    const db = getAccountDb();

    const [rows] = await db.execute<DbRow<QqBindingRow>[]>(
        "SELECT * FROM web_user_qq_bindings WHERE user_id = ? AND status IN ('pending', 'active') LIMIT 1",
        [userId]
    );
    const row = rows[0];
    if (!row) {
        throw createError({ statusCode: 404, statusMessage: "没有找到 QQ 绑定记录" });
    }

    await db.execute(
        `UPDATE web_user_qq_bindings
         SET status = 'removed', verify_code_hash = NULL, verify_code_expires_at = NULL,
             verify_attempts = 0, updated_at = NOW()
         WHERE id = ?`,
        [row.id]
    );

    return {
        qqNumber: row.qq_number,
        message: `QQ ${row.qq_number} 已解绑`
    };
};
