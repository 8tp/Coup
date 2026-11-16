import type { NamespaceTranslation } from '../../schema';

/**
 * vi `seo`. Written for what Vietnamese players search: "coup online",
 * "chơi coup online", "bài coup", "board game coup". Vietnamese rule
 * write-ups pair the English card names with Vietnamese ones, so the About
 * text gives the English name beside the glossary name once.
 */
const seo: NamespaceTranslation<'seo'> = {
  title: 'Coup Online: chơi bài Coup miễn phí với bạn bè hoặc bot',
  description: 'Chơi board game bịp bài Coup online với bạn bè hoặc bot, ngay trên trình duyệt. Tuyên bố nhân vật, thách thức người bịp và cướp xu, từ 2 đến 6 người.',
  ogTitle: 'Coup Online',
  ogImageAlt: 'Coup Online, board game bịp bài nhiều người chơi',
  manifestDescription: 'Chơi Coup nhiều người theo thời gian thực. Bịp và thách thức bạn bè hoặc bot, không cần tài khoản.',

  aboutHeading: 'Về Coup Online',
  aboutIntro: 'Coup Online là bản chơi trên web miễn phí của Coup (bản tiếng Việt có tên Cuộc chiến vương quyền), board game bịp bài và suy luận cho {min, number} đến {max, number} người. Mỗi người bắt đầu với 2 lá nhân vật úp, gọi là ảnh hưởng, và 2 xu. Bạn được tuyên bố có bất kỳ nhân vật nào, dù có giữ lá đó hay không. Mất cả hai lá là bạn bị loại. Người cuối cùng còn bài sẽ thắng.',
  roundHeading: 'Một lượt chơi',
  roundBody: 'Tới lượt mình, bạn chọn một hành động. Thu nhập và Viện trợ cho bạn thêm xu. Hành động của nhân vật, như Thu thuế của Công tước (Duke) hay Cướp của Thuyền trưởng (Captain), là lời tuyên bố rằng bạn có lá đó. Bất kỳ ai cũng có thể thách thức lời tuyên bố: nếu đó là bịp thì người bịp mất một lá, còn nếu là thật thì người thách thức mất một lá. Một số hành động có thể bị chặn bằng cách tuyên bố đúng nhân vật, và lượt chặn cũng có thể bị thách thức. Với {coupCost, number} xu, bạn có thể Đảo chính (Coup), khiến bất kỳ ai mất một lá mà không ai chặn được. Khi có {forcedCoup, number} xu thì bạn bắt buộc phải Đảo chính.',
  freeHeading: 'Miễn phí, không cần tài khoản',
  freeBody: 'Coup Online chơi miễn phí. Không cần đăng ký: nhập tên là chơi. Game chạy trên trình duyệt của điện thoại, máy tính bảng và máy tính, và bạn có thể thêm nó vào màn hình chính như một ứng dụng.',
  faqHeading: 'Câu hỏi thường gặp',
  faqFriendsQ: 'Chơi Coup online với bạn bè được không?',
  faqFriendsA: 'Được. Tạo phòng rồi gửi mã phòng 4 chữ cái hoặc link mời. Bạn bè vào bằng điện thoại hay máy tính của họ, không cần tài khoản.',
  faqBotsQ: 'Có chơi Coup với bot được không?',
  faqBotsA: 'Được. Nút Chơi với bot mở ngay một ván với {bots, plural, other {# người chơi máy}}. Bạn cũng có thể thêm bot vào phòng chơi cùng bạn bè và chọn kiểu chơi cho từng bot.',
  faqPhoneQ: 'Chơi trên điện thoại được không?',
  faqPhoneA: 'Được. Game chạy trên trình duyệt của Android và iPhone, không cần tải gì về. Thêm vào màn hình chính để mở như một ứng dụng.',
  faqFreeQ: 'Coup Online có miễn phí không?',
  faqFreeA: 'Có. Mọi chế độ chơi đều miễn phí, và bạn không bao giờ cần tài khoản.',
  faqPlayersQ: 'Coup chơi được bao nhiêu người?',
  faqPlayersA: '{min, number} đến {max, number} người. Bot có thể lấp các ghế trống, nên bạn cũng có thể chơi một mình.',
  faqReformationQ: 'Bản mở rộng Cải cách (Reformation) là gì?',
  faqReformationA: 'Cải cách chia bàn chơi thành hai phe, Bảo hoàng và Cải cách. Khi cả hai phe còn trong ván, bạn không thể Đảo chính, Ám sát hay Cướp người cùng phe. Bản này thêm hai hành động Cải đạo và Biển thủ cùng Quỹ dự trữ, và Phán quan có thể thay cho Đại sứ. Chủ phòng bật nó trong phòng chờ.',
  credit: 'Coup Online là bản chuyển thể không chính thức do người hâm mộ làm từ Coup, board game do Rikki Tahta thiết kế, được La Mame Games và Indie Boards & Cards phát hành. Trang này không liên kết với các bên đó và không được họ bảo trợ.',
  languages: 'Ngôn ngữ',
  suggestion: 'Đọc bằng tiếng Việt',
  suggestionDismiss: 'Đóng',
};

export default seo;
