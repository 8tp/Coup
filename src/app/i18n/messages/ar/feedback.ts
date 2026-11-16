import type { NamespaceTranslation } from '../../schema';

/** ar `feedback`. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: 'إرسال ملاحظة',
  kindLabel: 'نوع الملاحظة',
  'kind.bug': 'خطأ',
  'kind.idea': 'فكرة',
  'kind.other': 'أخرى',
  'placeholder.bug': 'ما الذي حدث، وما الذي كان متوقعًا.',
  'placeholder.idea': 'اقتراحك لتغيير شيء أو إضافته.',
  'placeholder.other': 'أي شيء في بالك.',
  noteLabel: 'ملاحظتك',
  privacy: 'تُرسل دون اسمك أو رمز الغرفة.',
  send: 'إرسال',
  sending: 'جارٍ الإرسال',
  retry: 'إعادة المحاولة',
  sent: 'أُرسلت. شكرًا على الملاحظة.',
  sentDetail: 'تصل مباشرة إلى المطوّر.',
  writeAnother: 'كتابة ملاحظة أخرى',
  githubInstead: 'فتح بلاغ على GitHub بدلًا من ذلك',
  'error.invalid': 'تعذّر إرسال الملاحظة. يرجى إعادة المحاولة.',
  'error.empty': 'يلزم كتابة بضع كلمات أولًا.',
  'error.too_long': '{max, plural, zero {الحد الأقصى # حرف.} one {الحد الأقصى حرف واحد.} two {الحد الأقصى حرفان.} few {الحد الأقصى # أحرف.} many {الحد الأقصى # حرفًا.} other {الحد الأقصى # حرف.}}',
  'error.rate_limited': 'أرسلت عدة ملاحظات بالفعل. يمكنك المحاولة بعد بضع دقائق.',
  'error.busy': 'تصل ملاحظات كثيرة الآن. يمكنك المحاولة بعد بضع دقائق.',
  'error.server_error': 'تعذّر الإرسال. يرجى التحقق من الاتصال وإعادة المحاولة.',
};

export default feedback;
