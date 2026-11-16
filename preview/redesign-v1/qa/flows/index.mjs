import { paletteDesktop, palettePhone } from './palette.mjs'
import { syncFlow } from './sync.mjs'
import { overlayDesktop, overlayPhone } from './overlays.mjs'
import { routeState } from './routestate.mjs'
import { rapidNav } from './rapidnav.mjs'
import { toggles } from './toggles.mjs'
import { forms } from './forms.mjs'
import { screenReview } from './screenreview.mjs'
import { threadPaging, growthRanges, deepScroll, folds, density, paletteShowcase } from './rulings.mjs'

export const FLOWS = [paletteDesktop, palettePhone, syncFlow('desktop'), syncFlow('phone'), overlayDesktop, overlayPhone, routeState, rapidNav, toggles, forms, threadPaging, growthRanges, deepScroll, folds, density, screenReview, paletteShowcase]
