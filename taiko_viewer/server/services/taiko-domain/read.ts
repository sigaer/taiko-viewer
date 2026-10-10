import { createFileScoreReader } from "../../domain/file-score-reader.ts";
import { getRuntimePaths } from "../../internal/account/shared.ts";

/** Host composition; products consume the port without knowing storage layout. */
export const getDomainScoreReader = () => createFileScoreReader(getRuntimePaths().userdataDir, () => new Date().toISOString());
