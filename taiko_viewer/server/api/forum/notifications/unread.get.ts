import { getForumUnreadNotificationCount } from '~/server/utils/forum';

export default defineEventHandler(event => getForumUnreadNotificationCount(event));
