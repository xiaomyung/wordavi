/**
 * Log namespace for anything the learner did on purpose: a setting changed, a
 * screen navigated to, an install prompt answered, a report sent. One constant
 * so the whole UI files under the same name in the log ring — a report that
 * greps `ui` sees the entire user-visible trail, in order.
 */
export const UI_NS = 'ui';
