# Period to Overview transition analysis

## Reference

- Source: `页面过渡效果.mp4`
- Frame: 720 x 1568 portrait
- Duration: 7.32 s
- Nominal video stream: 60 fps; average rate is variable and close to 120 fps
- Forward transition used for calibration: approximately 2.60 s to 4.20 s
- Viewer transition duration: 1600 ms

The reference content is not copied. Only its plane hierarchy, perspective, timing,
opacity staging, and continuous background are used.

## Phases

| Internal time | Phase | Viewer mapping |
| --- | --- | --- |
| 0-360 ms | Previous copy exits | Period date, heading, body, and facts fade with a short stagger |
| 80-980 ms | Existing planes rotate | The exact Period covers freeze in place and rotate around their horizontal axes |
| 520-920 ms | Primary copy arrives | Overview eyebrow, title, song count, and chart count fade upward |
| 840-1240 ms | Secondary fact arrives | Estimated total play time appears after the primary facts |
| 1240-1600 ms | Settle | Plane scale, rotation, and opacity reach the Overview resting state |

## Layers

| Layer | Start | End | Motion and easing |
| --- | --- | --- | --- |
| background | continuous | continuous | Shared ice-blue field; no mount flash or cross-page replacement |
| shared-upper-planes | rx 0deg, scale 1 | rx -72deg, scale .88 | `power2.inOut`, 80-980 ms |
| shared-lower-planes | rx 0deg, scale 1 | rx 72deg, scale .88 | `power2.inOut`, 80-980 ms |
| previous-heading | y 0, opacity 1 | y -12px, opacity 0 | `power2.in`, 0-300 ms |
| previous-body-copy | y 0, opacity 1 | y -8px, opacity 0 | `power1.in`, 60-360 ms |
| center-anchor | y 0, scale 1 | y 0, scale 1 | Remains visually stable; only a subtle opacity handoff is allowed |
| next-heading | y 16px, opacity 0 | y 0, opacity 1 | `power2.out`, 520-920 ms |
| next-primary-facts | y 14px, opacity 0 | y 0, opacity 1 | `power2.out`, 600-920 ms |
| next-duration | y 18px, opacity 0 | y 0, opacity 1 | `power2.out`, 840-1240 ms |

The scene uses a 900 px perspective with its origin near the vertical center. The
reference runs from a diamond-like plane toward a square. The viewer uses the
requested inverse direction: square Period covers rotate into diamond-like Overview
planes. The planes remain rigid rectangles; Canvas/WebGL and animated blur are unnecessary.

## DOM mapping and controller

- `PeriodSlide` and `OverviewSlide` render the same scene at fixed times 0 ms and
  1600 ms, so handing control to or from the transition overlay is pixel-stable.
- `StoryPlayer` owns the transition clock, locks repeated navigation while it is
  running, and commits the target scroll-snap position only after the clock ends.
- `AnnualVerticalCoverStream` supplies one deterministic, disjoint upper/lower cover
  set to both endpoints and the overlay. All instances read one shared animation
  phase; that phase freezes during the transition, so the exact visible covers keep
  their positions while their inner plane wrappers rotate.
- Failed covers render a neutral Taiko plane. A zone with no source uses one static
  fallback rather than a fallback that repeatedly travels through the corridor.
- In development, `?transitionTime=0..1600` freezes the overlay at an exact clock
  value for reference-frame comparison. Production ignores the query parameter.
- Reduced motion replaces the 3D sequence with a 180 ms opacity handoff.

## Comparison checkpoints

Reference times map to viewer clock values as follows:

| Reference | Viewer |
| --- | --- |
| 2.60 s | 0 ms |
| 2.80 s | 200 ms |
| 3.00 s | 400 ms |
| 3.20 s | 600 ms |
| 3.40 s | 800 ms |
| 3.60 s | 1000 ms |
| 3.80 s | 1200 ms |
| 4.00 s | 1400 ms |
| 4.20 s | 1600 ms |

The first comparison pass prioritizes layer order and timing. The second pass
adjusts Y/Z travel, `rotateX`, scale, opacity, and per-layer easing independently.

## Calibration result

The nine frozen checkpoints were captured at the 720 x 1568 reference viewport.
The correction pass removed the independently timed Period and Overview streams.
The cover corridor now freezes at navigation time, keeps cover identity and outer
transform unchanged, and animates only the nested plane rotation. The blue-white
background uses a 360 x 784 low-frequency texture derived from the supplied
`page_3.jpg` light field. Heavy downsampling, blur, and hue normalization remove all
source copy and artwork; the original reference image is not shipped. The remaining
visible difference is content-driven: viewer covers vary while the reference planes
use more uniform artwork proportions.
