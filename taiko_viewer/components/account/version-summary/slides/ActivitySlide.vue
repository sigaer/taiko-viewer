<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  kind: "favoriteShift" | "monthly" | "weekday" | "calendar" | "timeOfDay" | "lateNight" | "ratingRank";
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const copy = computed(() => ({
  favoriteShift: props.summary.copy.favoriteShift,
  monthly: props.summary.copy.monthlyFavorites,
  weekday: props.summary.copy.weekdayActivity,
  calendar: props.summary.copy.calendarActivity,
  timeOfDay: props.summary.copy.timeOfDay,
  lateNight: props.summary.copy.lateNight,
  ratingRank: props.summary.copy.ratingRank
})[props.kind]);
const tone = computed(() => props.kind === "lateNight" ? "royal" : props.kind === "ratingRank" ? "gold" : "aurora");
const maxWeekday = computed(() => Math.max(...(props.summary.weekdayActivity?.counts || [1]), 1));
const rankArc = computed(() => Math.max(4, Math.min(96, props.summary.ratingRank?.percentile || 0)));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="copy.eyebrow" :title="copy.title" :lead="copy.body" :tone="tone" :active="active" :reduced-motion="reducedMotion">
    <div v-if="kind === 'favoriteShift' && summary.favoriteShift" class="shift" data-animate>
      <article class="record record--old">
        <span>OLD FAVORITE</span><img :src="summary.favoriteShift.oldFavorite.coverUrl" alt="" />
        <strong>{{ summary.favoriteShift.oldFavorite.name }}</strong><small>{{ summary.favoriteShift.oldFavorite.playCount }} plays</small>
      </article>
      <div class="pulse-line"><i></i><b>●</b><i></i></div>
      <article class="record record--new">
        <span>NEW FAVORITE</span><img :src="summary.favoriteShift.newFavorite.coverUrl" alt="" />
        <strong>{{ summary.favoriteShift.newFavorite.name }}</strong><small>{{ summary.favoriteShift.newFavorite.playCount }} plays</small>
      </article>
    </div>

    <div v-else-if="kind === 'monthly'" class="month-track" data-animate>
      <article v-for="item in summary.monthlyFavorites" :key="item.month" class="month-card">
        <div><img :src="item.song.coverUrl" alt="" /><span>{{ item.monthLabel }}</span></div>
        <strong>{{ item.song.name }}</strong><small>{{ item.playCount }} 次鼓点</small>
      </article>
    </div>

    <div v-else-if="kind === 'weekday' && summary.weekdayActivity" class="weekday-drum" data-animate>
      <div v-for="(count, index) in summary.weekdayActivity.counts" :key="index" class="weekday-beat" :class="{ hot: index === summary.weekdayActivity.topWeekday }">
        <span :style="{ '--height': `${18 + count / maxWeekday * 72}%` }"></span>
        <strong>{{ summary.weekdayActivity.labels[index] }}</strong><small>{{ count }}</small>
      </div>
      <p>{{ summary.weekdayActivity.topLabel }}</p>
    </div>

    <div v-else-if="kind === 'calendar' && summary.calendarActivity" class="calendar-drum" data-animate>
      <div class="calendar-drum__skin">
        <span v-for="day in summary.calendarActivity.days" :key="day.date" :title="`${day.date}: ${day.playCount}`" :style="{ '--heat': day.intensity }"></span>
        <strong>{{ summary.calendarActivity.days.length }}</strong><small>ACTIVE DAYS</small>
      </div>
      <p>{{ summary.calendarActivity.days[0]?.date }} — {{ summary.calendarActivity.days.at(-1)?.date }}</p>
    </div>

    <div v-else-if="kind === 'timeOfDay' && summary.timeOfDay" class="clock-drum" data-animate>
      <div class="clock-drum__ring">
        <span v-for="(period, index) in summary.timeOfDay.periods" :key="period.key" :style="{ '--turn': `${index * 90}deg` }"><i></i><b>{{ period.label }}</b><small>{{ period.playCount }}</small></span>
        <strong>{{ summary.timeOfDay.topLabel }}</strong><small>MOST ACTIVE</small>
      </div>
    </div>

    <div v-else-if="kind === 'lateNight' && summary.lateNight" class="midnight" data-animate>
      <div class="moon-record"><img :src="summary.lateNight.song.coverUrl" alt="" /></div>
      <div><span>{{ summary.lateNight.latestLabel }}</span><strong>{{ summary.lateNight.song.name }}</strong><p>{{ summary.lateNight.playCount }} 次深夜鼓点</p></div>
    </div>

    <div v-else-if="kind === 'ratingRank' && summary.ratingRank" class="rating-drum" data-animate>
      <div class="rating-drum__ring" :style="{ '--rank-arc': `${rankArc * 3.6}deg` }">
        <strong>{{ summary.ratingRank.rating.toFixed(2) }}</strong><small>TAIKOB20</small>
      </div>
      <div class="rating-copy"><strong>#{{ summary.ratingRank.rank }}</strong><span>/ {{ summary.ratingRank.sampleSize }}</span><p>超过站内样本 {{ summary.ratingRank.percentile }}%</p><small>站内玩家样本 · 非官方全服排名</small></div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.shift,.midnight,.rating-drum{height:100%;display:grid;align-items:center}.shift{grid-template-columns:1fr auto 1fr;gap:clamp(10px,3vw,40px)}
.record{display:grid;justify-items:center;gap:8px;min-width:0}.record img{width:min(28vh,260px);aspect-ratio:1;border-radius:50%;object-fit:cover;border:12px solid #12182f;box-shadow:0 20px 60px #05091d88}.record--old img{filter:sepia(.35)}.record--new img{box-shadow:0 0 0 2px #f6c86e,0 0 60px #6f8cff88}.record span,.record small,.month-card small{font-size:11px;letter-spacing:.12em;color:#ffe4ba}.record strong,.month-card strong{color:#fff4de;text-align:center;max-width:22ch}.pulse-line{display:flex;align-items:center;color:#f6c86e}.pulse-line i{width:4vw;height:1px;background:#f6c86e88}.pulse-line b{animation:pulse 1.5s infinite}
.month-track{height:100%;display:flex;gap:14px;align-items:center;overflow:hidden;padding:8px}.month-card{flex:1;min-width:0;display:grid;gap:7px;padding:12px;border-radius:24px;background:#ffffff0c;border:1px solid #ffffff1c}.month-card div{position:relative}.month-card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px}.month-card span{position:absolute;left:8px;bottom:8px;padding:5px 8px;border-radius:99px;background:#111936cc;color:#fff4de;font-size:10px}
.weekday-drum{height:100%;display:grid;grid-template-columns:repeat(7,1fr);align-items:end;gap:9px;padding:5% 3%;position:relative}.weekday-beat{height:80%;display:grid;grid-template-rows:1fr auto auto;justify-items:center;gap:5px}.weekday-beat>span{align-self:end;width:min(52px,80%);height:var(--height);border-radius:99px 99px 20px 20px;background:linear-gradient(#6f8cff,#f05a47);box-shadow:0 0 28px #6f8cff55}.weekday-beat.hot>span{background:linear-gradient(#fff0a9,#f05a47);box-shadow:0 0 38px #f6c86e99}.weekday-beat strong{font-size:12px;color:#fff4de}.weekday-beat small{color:#f6c86e}.weekday-drum p{position:absolute;right:0;top:0;font:700 clamp(2rem,8vw,6rem)/1 var(--viewer-display-font);color:#ffffff0b}
.calendar-drum,.clock-drum{height:100%;display:grid;place-items:center}.calendar-drum__skin,.clock-drum__ring,.rating-drum__ring{position:relative;width:min(46vh,460px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;border:18px solid #e7a84f;box-shadow:inset 0 0 0 7px #7d301f,inset 0 0 70px #f05a4728,0 30px 80px #05091d88}.calendar-drum__skin{grid-template-columns:repeat(10,1fr);grid-auto-rows:1fr;padding:18%;gap:3px}.calendar-drum__skin span{border-radius:50%;background:rgba(246,200,110,calc(.12 + var(--heat) * .88));box-shadow:0 0 calc(var(--heat) * 12px) #f6c86e}.calendar-drum__skin strong,.calendar-drum__skin>small{position:absolute}.calendar-drum__skin strong{font-size:3rem;color:#fff4de}.calendar-drum__skin>small{margin-top:4rem;color:#f6c86e;letter-spacing:.15em}.calendar-drum>p{margin:-2rem 0 0;color:#fff4deaa}
.clock-drum__ring>strong,.clock-drum__ring>small{position:absolute;color:#fff4de}.clock-drum__ring>strong{font-size:clamp(2rem,7vw,4.5rem)}.clock-drum__ring>small{margin-top:5rem;letter-spacing:.16em;color:#f6c86e}.clock-drum__ring>span{position:absolute;inset:7%;transform:rotate(var(--turn));display:flex;justify-content:center}.clock-drum__ring>span i{width:2px;height:18%;background:#f6c86e}.clock-drum__ring>span b,.clock-drum__ring>span small{position:absolute;transform:rotate(calc(-1 * var(--turn)));color:#fff4de}.clock-drum__ring>span b{top:20%}.clock-drum__ring>span small{top:30%;color:#f6c86e}
.midnight{grid-template-columns:1fr 1fr;gap:7vw}.moon-record{justify-self:end;width:min(40vh,380px);aspect-ratio:1;border-radius:50%;padding:14%;background:radial-gradient(circle at 35% 30%,#fff9d7,#8aa3ff 45%,#252e70 70%);box-shadow:0 0 80px #6f8cff66}.moon-record img{width:100%;height:100%;border-radius:50%;object-fit:cover;mix-blend-mode:multiply}.midnight>div:last-child{display:grid;gap:12px}.midnight span{color:#aebcff}.midnight strong{font:700 clamp(2rem,5vw,4.6rem)/1.05 var(--viewer-display-font);color:#fff4de}.midnight p{color:#f6c86e}
.rating-drum{grid-template-columns:1fr 1fr;gap:6vw}.rating-drum__ring{justify-self:end;background:conic-gradient(#f6c86e var(--rank-arc),#ffffff15 0);border-color:#f05a47}.rating-drum__ring:after{content:"";position:absolute;inset:12%;border-radius:50%;background:#151c3d}.rating-drum__ring strong,.rating-drum__ring small{z-index:1;color:#fff4de}.rating-drum__ring strong{font-size:clamp(2.5rem,7vw,5.5rem)}.rating-drum__ring small{margin-top:6rem;letter-spacing:.16em;color:#f6c86e}.rating-copy{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:8px}.rating-copy strong{font-size:clamp(3rem,9vw,7rem);color:#fff4de}.rating-copy span{color:#f6c86e}.rating-copy p,.rating-copy small{grid-column:1/-1;color:#fff4de}.rating-copy small{opacity:.58}
@keyframes pulse{50%{transform:scale(1.7);filter:drop-shadow(0 0 10px #f6c86e)}}
@media(max-width:720px){.shift{gap:5px}.record img{width:min(30vw,150px);border-width:7px}.month-track{align-items:stretch;overflow-x:auto;scroll-snap-type:x mandatory}.month-card{flex:0 0 40%;scroll-snap-align:center}.weekday-drum{gap:4px}.weekday-beat strong{font-size:9px}.calendar-drum__skin,.clock-drum__ring,.rating-drum__ring{width:min(68vw,38vh);border-width:10px}.midnight,.rating-drum{grid-template-columns:1fr;gap:10px;text-align:center}.moon-record,.rating-drum__ring{justify-self:center;width:min(46vw,28vh)}.midnight strong{font-size:1.6rem}.rating-copy{justify-content:center}.rating-copy strong{font-size:2.8rem}.rating-drum__ring small{margin-top:4rem}}
@media(prefers-reduced-motion:reduce){.pulse-line b{animation:none}}
</style>
