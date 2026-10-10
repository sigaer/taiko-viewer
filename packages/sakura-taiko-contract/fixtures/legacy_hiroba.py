"""Frozen legacy mapping oracle; never imported by production code."""
from __future__ import annotations

def score_detail_to_userdata_record(detail: HirobaScoreDetail) -> Dict[str, Any]:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    badge_rank = BADGE_NAME_TO_RANK.get(detail.badge or "", 0)
    return {
        "song_no": int(detail.song_no),
        "level": int(detail.level),
        "high_score": int(detail.score),
        "best_score_rank": int(badge_rank),
        "good_cnt": int(detail.good),
        "ok_cnt": int(detail.ok),
        "ng_cnt": int(detail.bad),
        "pound_cnt": int(detail.roll),
        "combo_cnt": int(detail.max_combo),
        "option_flg": [1, 0, 0, "00"],
        "stage_cnt": int(detail.stage_cnt),
        "clear_cnt": int(detail.clear_cnt),
        "full_combo_cnt": int(detail.full_combo_cnt),
        "dondaful_combo_cnt": int(detail.dondaful_combo_cnt),
        "highscore_datetime": now,
        "highscore_mode": 0,
        "update_datetime": now,
        "_hiroba_crown": detail.crown,
        "_hiroba_badge": detail.badge,
    }
