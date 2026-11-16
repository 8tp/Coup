import type { FeedbackErrorCode, FeedbackKind } from '@/shared/feedbackTypes';

/**
 * Short feedback lines: the in-game feedback form (`components/feedback/
 * FeedbackForm.tsx`) now; toasts, reactions and chat chrome in phase 2.
 *
 * The form's server errors are already stable codes (`FeedbackErrorCode`,
 * the `feedback:send` acknowledgement), one key each under `error.`.
 */
const feedback = {
  title: 'Send feedback',
  kindLabel: 'Kind of note',
  'kind.bug': 'Bug',
  'kind.idea': 'Idea',
  'kind.other': 'Other',
  'placeholder.bug': 'Tell us what happened and what you expected.',
  'placeholder.idea': "Tell us what you'd change or add.",
  'placeholder.other': 'Tell us anything.',
  noteLabel: 'Your note',
  privacy: 'Sent without your name or room code.',
  send: 'Send',
  sending: 'Sending',
  retry: 'Try again',
  sent: 'Sent. Thanks for the note.',
  sentDetail: 'It goes straight to the developer.',
  writeAnother: 'Write another',
  githubInstead: 'Open a GitHub issue instead',
  'error.invalid': "Couldn't send that note. Try again.",
  'error.empty': 'Write a few words first.',
  'error.too_long': 'Keep it under {max} characters.',
  'error.rate_limited': "You've sent a few notes already. Try again in a few minutes.",
  'error.busy': 'Too many notes are coming in right now. Try again in a few minutes.',
  'error.server_error': "Couldn't send. Check your connection and try again.",
} satisfies Record<`kind.${FeedbackKind}` | `placeholder.${FeedbackKind}` | `error.${FeedbackErrorCode}`, string> & Record<string, string>;

export default feedback;
