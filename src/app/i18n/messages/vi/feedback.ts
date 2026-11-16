import type { NamespaceTranslation } from '../../schema';

/** vi `feedback`. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: 'Gửi góp ý',
  kindLabel: 'Loại góp ý',
  'kind.bug': 'Lỗi',
  'kind.idea': 'Ý tưởng',
  'kind.other': 'Khác',
  'placeholder.bug': 'Kể lại chuyện gì đã xảy ra và bạn mong đợi điều gì.',
  'placeholder.idea': 'Bạn muốn sửa hoặc thêm gì.',
  'placeholder.other': 'Bạn muốn nói gì cũng được.',
  noteLabel: 'Góp ý của bạn',
  privacy: 'Gửi đi không kèm tên hay mã phòng của bạn.',
  send: 'Gửi',
  sending: 'Đang gửi',
  retry: 'Thử lại',
  sent: 'Đã gửi. Cảm ơn bạn đã góp ý.',
  sentDetail: 'Góp ý được gửi thẳng tới nhà phát triển.',
  writeAnother: 'Viết thêm',
  githubInstead: 'Mở issue trên GitHub',
  'error.invalid': 'Không gửi được góp ý này. Thử lại nhé.',
  'error.empty': 'Viết vài chữ trước đã.',
  'error.too_long': 'Viết dưới {max} ký tự.',
  'error.rate_limited': 'Bạn đã gửi khá nhiều góp ý rồi. Vài phút nữa thử lại nhé.',
  'error.busy': 'Lúc này có quá nhiều góp ý gửi tới. Vài phút nữa thử lại nhé.',
  'error.server_error': 'Không gửi được. Kiểm tra kết nối rồi thử lại.',
};

export default feedback;
