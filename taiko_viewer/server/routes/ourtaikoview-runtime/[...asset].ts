import { defineEventHandler, getRouterParam } from 'h3';
import { servePracticeAsset } from '../../utils/practice-player.mjs';

export default defineEventHandler(event => servePracticeAsset(event, getRouterParam(event, 'asset')));
