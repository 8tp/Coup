import type { NamespaceTranslation } from '../../schema';

/** vi `home`. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online: board game bịp bài nhiều người chơi, miễn phí',
  tagline: 'Board game bịp bài, chơi online với bạn bè hoặc bot.',
  presenceOnline: '<fig>{count}</fig> người đang online',
  presenceGames: '{count, plural, other {<fig>#</fig> ván đang chơi}}',
  myStats: 'Thành tích',

  playSection: 'Chơi',
  nameLabel: 'Tên của bạn',
  playVsBots: 'Chơi với bot',
  playVsBotsSub: 'Vào ngay · {count, plural, other {# đối thủ}}',
  dealing: 'Đang chia bài…',
  createRoom: 'Tạo phòng',
  joinRoom: 'Vào phòng',
  publicRoom: 'Phòng công khai',
  publicRoomOn: 'Hiện trên màn hình này. Ai cũng vào được.',
  publicRoomOff: 'Chỉ người có mã mới vào được.',
  creating: 'Đang tạo…',
  createAndInvite: 'Tạo và mời',
  codePlaceholder: 'MÃ',
  roomCode: 'Mã phòng',
  joining: 'Đang vào…',
  join: 'Vào',

  learnTitle: 'Học chơi',
  learnSub: 'Ván có hướng dẫn, bài học hoặc luật chơi',

  openTables: 'Bàn đang chờ',
  watchLive: 'Xem trực tiếp',
  browseAll: 'Xem tất cả',
  noPublicTables: 'Hiện chưa có bàn công khai nào.',
  roomName: 'Bàn của {host}',
  roomPlayers: '<fig>{seats}</fig> người chơi',
  roomPlayersBetweenGames: '<fig>{seats}</fig> người chơi · đang nghỉ giữa ván',
  roomPlayersWatching: '<fig>{seats}</fig> người chơi · {watching} người xem',
  roomFull: 'Đầy',
  watch: 'Xem',

  footer: '{min}–{max} người · miễn phí · không cần đăng ký',
  source: 'Mã nguồn',
  sourceLabel: 'Xem mã nguồn trên GitHub',

  defaultSpectatorName: 'Người xem',
  defaultPlayerName: 'Người chơi',

  guidedGame: 'Chơi ván có hướng dẫn',
  guidedGameSub: 'Bạn đấu với 1 bot hiền. Huấn luyện viên chỉ bạn nên làm gì tiếp.',
  tutorial: 'Học qua bài hướng dẫn',
  tutorialSub: '6 bài ngắn. Bạn thử từng nước đi trên một bàn nhỏ.',
  rules: 'Đọc luật chơi',
  rulesSub: 'Nhân vật, hành động, thách thức và chặn. Có cả bản Cải cách.',
  practiceFoot: 'Thêm bot, đổi luật hoặc tắt hướng dẫn',
  practiceSetup: 'Tùy chỉnh ván tập',

  installTitle: 'Cài Coup',
  installBody: 'Mở nhanh hơn, và dữ liệu game đã lưu vẫn tải được khi Wi-Fi yếu.',
  install: 'Cài',
  installDismiss: 'Đóng gợi ý cài đặt',
};

export default home;
