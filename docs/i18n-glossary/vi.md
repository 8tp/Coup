# Vietnamese (vi) glossary

The game's vocabulary in Vietnamese, used in every namespace under
`src/app/i18n/messages/vi/`. `glossary.ts` holds the same names. Nobody who
speaks Vietnamese natively has reviewed this yet, so treat it as a first draft.

## Sources and the naming decision

- A Vietnamese edition exists: Analog.games lists "Coup: Cuộc chiến vương quyền"
  with Board Game VN among the publishers. I could not find out whether it
  prints Vietnamese names on the cards. Vietnamese shops also sell it as
  "Coup cuộc chiến quyền lực".
- Vietnamese rule write-ups (luatchoi.edu.vn, thegioiboardgame.vn,
  boardgamespace.wordpress.com, mytour.vn, rubikonline.vn) keep the English
  card name and give a Vietnamese gloss next to it: "Duke (Công tước)",
  "Assassin (Sát thủ)", "Ambassador (Đại sứ)", "Contessa (Nữ bá tước)",
  "Income (Thu nhập)", "Foreign Aid (Viện trợ nước ngoài)". Captain is
  translated four different ways (Thuyền trưởng, Đội trưởng, Đại úy, Đại tá).
- **Decision: Vietnamese names everywhere.** A player can learn the whole game
  from this text without knowing English, and the names say what each card
  does (Sát thủ kills, Đại sứ is a diplomat, Thu thuế collects tax). The card
  art in this app has no printed name, so nothing on screen contradicts the
  Vietnamese names. Players who know the English names will see them once:
  the About text on the landing page gives "Công tước (Duke)", "Thuyền trưởng
  (Captain)" and "Đảo chính (Coup)".
- The game's name stays "Coup". The About text says the Vietnamese edition is
  called Cuộc chiến vương quyền. "Coup Online" is never translated.

## Register

- The player is **bạn** throughout, neutral and friendly, the usual way
  Vietnamese apps and games address young adults. No regional slang in rules
  text. Buttons are bare verbs with no pronoun ("Thách thức", "Bỏ qua").
- Other players are named, or called **họ** (they). Vietnamese pronouns have
  no gender, so "họ" works for anyone. Where "họ" could be unclear the text
  says "người chơi đó", "người tuyên bố" or "người thách thức".
- When a quick chat phrase speaks as the player it uses **mình** ("Mình có lá
  đó"), the friendly first person. It is neither the rude "tao" nor the stiff
  "tôi".
- Vietnamese has one plural category (`other`). Messages use
  `{count, plural, other {# xu}}`, and `=1` only where Vietnamese actually words
  one thing differently from several (`reveal.swap`, `blockHint.*`,
  `winCaughtBluffing`).
- Log lines keep the `you` select only to start a sentence with a capital
  "Bạn". Mid-sentence the reader appears as "bạn" (`log.you`, `gameover.you`).
- Action names are capitalised like proper nouns when they name the action
  ("lấy Thu nhập", "phải Đảo chính") and lowercase when they are the verb of a
  log line ("Bạn thu thuế (+3 xu)", "biển thủ Quỹ dự trữ").

## Characters

| English | Vietnamese | Note | Confidence |
|---|---|---|---|
| Duke | Công tước | Every source agrees. | High |
| Assassin | Sát thủ | Every source agrees. | High |
| Captain | Thuyền trưởng | The commonest gloss, and the card shows a ship's officer. Đội trưởng would avoid the stacked mark in "THUYỀN" but reads as "team captain". | Medium |
| Ambassador | Đại sứ | Every source agrees. | High |
| Contessa | Nữ bá tước | The correct word for countess. One source has Nữ hầu tước (marchioness). | Medium-high |
| Inquisitor | Phán quan | No Vietnamese source covers Reformation. Phán quan is the judge who reads everyone's secrets in folk belief, which fits Examine. It is short and has no stacked marks. | Low-medium |

## Actions

| English | Vietnamese | Note | Confidence |
|---|---|---|---|
| Income | Thu nhập | Every source agrees. | High |
| Foreign Aid | Viện trợ | Sources write Viện trợ nước ngoài or quốc tế. I shortened it for buttons, and it stays clear because no other aid exists. | Medium-high |
| Coup | Đảo chính | The literal meaning. One source has Lật đổ, and some keep "Coup". Đảo chính works as a verb ("Đảo chính Alex"), so the action can be named from the reader's language. | Medium |
| Tax | Thu thuế | A verb phrase so that "tuyên bố có Công tước để Thu thuế" reads naturally. | High |
| Steal | Cướp | Short. The card's job is taking coins by force. | High |
| Assassinate | Ám sát | | High |
| Exchange | Đổi bài | "Swap cards", the plainest wording. | High |
| Convert | Cải đạo | Literally "change religion". It fits a Reformation setting and the faction switch. | Medium |
| Embezzle | Biển thủ | The exact word for misappropriating funds. | High |
| Examine | Tra xét | "Inspect, interrogate". | Medium |

## Core terms

| English | Vietnamese | Note | Confidence |
|---|---|---|---|
| influence | ảnh hưởng (lá ảnh hưởng) | Introduced once as "hai lá bài úp, gọi là ảnh hưởng". After that the text says "mất một lá" (lose a card), following VOICE.md. | Medium |
| card | lá bài, lá | | High |
| claim (noun, verb) | lời tuyên bố, tuyên bố có X | "Tuyên bố có Công tước" means "claim to hold the Duke". An Embezzle claim is "tuyên bố không có Công tước". | Medium-high |
| bluff | bịp, cú bịp | The everyday word for bluffing at cards. "Caught bluffing" is "lộ bịp" or "bị lật tẩy". | High |
| challenge | thách thức | Used by the Vietnamese guides. | High |
| block | chặn, lượt chặn | | High |
| pass | bỏ qua | Accepting a block or claim is "cho qua" (let it through). | High |
| coins | xu | "3 xu". | High |
| treasury | ngân khố | | High |
| Treasury Reserve / reserve | Quỹ dự trữ, quỹ dự trữ; "Dự trữ" on the felt label | | Medium-high |
| faction | phe | | High |
| Loyalist | Bảo hoàng | "Royalist", a historical faction name that pairs with Cải cách. The seat mark is "▲ BH" (initials). | Medium |
| Reformist | Cải cách | Same word as the expansion. English has the same echo (Reformation and Reformist). The faction is always written "phe Cải cách". The seat mark is "◆ CC". | Medium |
| Classic, Reformation (modes) | Cổ điển, Cải cách | | Medium-high |
| eliminated / out | bị loại | | High |
| turn | lượt | | High |
| room, lobby, host | phòng, phòng chờ, chủ phòng | | High |
| bot | bot | Vietnamese players say "bot". Computer player in prose is "người chơi máy". | High |
| spectator | người xem | | High |
| reaction | biểu cảm | | Medium-high |
| deck | chồng bài | | High |
| coach (practice) | huấn luyện viên, "HLV" on the tag | | Medium |
| seconds | `{seconds}s` on timers and slider ends, "giây" in sentences | | Medium |

## Jokes and names

| English | Vietnamese | Why |
|---|---|---|
| Pants on Fire | Chú Cuội | From the idiom "nói dối như Cuội" (to lie like Cuội, the boy in the moon). |
| Honest Abe | Thật như đếm | From the idiom "thật thà như đếm" (honest as counting). |
| The Inquisitor | Phán quan | Repeats the Inquisitor's card name, as the pun asks. |
| Eagle Eye | Thánh soi | Internet slang for someone who spots everything. |
| The Wall | Bức tường | |
| Smooth Operator | Cáo già | "Old fox", the sly one nobody catches. |
| Coup Machine | Vua đảo chính | "King of coups". "Cỗ máy đảo chính" was cut off on the stats card. |
| Silent Assassin | Thích khách | The martial-arts-novel word for an assassin who strikes unseen. "Sát thủ thầm lặng" was cut off. |
| Bold Strategy | Liều ăn nhiều | The proverb "the bold eat well", used ironically for challenges that backfired. |
| Quick Exit | Về sớm | "Went home early". |
| Reactions | GG, Bịp đỉnh, Có mùi (sus: "smells fishy"), Cay (salty), Ghê (wow), Haha, Toang (RIP: "it's over"), Vô lý (no way), Não to (big brain), Run quá (sweating), Soi đấy (watching you), Cãi cố (cope) | Common Vietnamese gaming and internet slang. |
| Bot styles | Ngẫu nhiên, Hung hăng, Thận trọng, Thù dai, Xảo quyệt, Phân tích, Tối ưu; practice styles Hiền, Khôn, Gắt | |
| Table talk | Bàn tán | A pun: "bàn" is both "table" and "discuss". |
