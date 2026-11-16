import type { NamespaceTranslation } from '../../schema';

/** zh-Hans `feedback`: the in-game feedback form. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: '发送反馈',
  kindLabel: '反馈类型',
  'kind.bug': '问题',
  'kind.idea': '建议',
  'kind.other': '其他',
  'placeholder.bug': '说说发生了什么，以及你本来期望怎样。',
  'placeholder.idea': '说说你想改什么、加什么。',
  'placeholder.other': '想说什么都行。',
  noteLabel: '你的反馈',
  privacy: '发送时不附带你的名字和房间码。',
  send: '发送',
  sending: '发送中',
  retry: '重试',
  sent: '已发送，感谢反馈。',
  sentDetail: '反馈会直接送到开发者手里。',
  writeAnother: '再写一条',
  githubInstead: '改为在 GitHub 上提交 issue',
  'error.invalid': '这条反馈没能发送，请重试。',
  'error.empty': '先写几句吧。',
  'error.too_long': '请控制在 {max} 个字符以内。',
  'error.rate_limited': '你已经发了好几条，请过几分钟再试。',
  'error.busy': '现在反馈太多，请过几分钟再试。',
  'error.server_error': '发送失败。请检查网络后重试。',
};

export default feedback;
