# 互动视觉小说引擎 v1 设计文档

## 产品定义
这不是一个普通的视觉小说阅读器，也不是一个聊天式角色扮演工具。

它是一个 `小说解析与改编引擎`：
- 输入是一整本小说
- 中间产物是结构化世界模型
- 输出是一个可游玩的互动视觉小说游戏

系统必须先完成“理解一本小说”，再完成“把它变成一个能玩的故事”。

## 核心目标
第一版要打通以下完整链路：

1. 导入一部中文纯文本小说
2. 提炼出角色卡、世界书、时间线、关系网、关键事件和原著规则
3. 生成一个可计算的世界模型
4. 在这个世界模型上运行状态变化与规则判断
5. 把状态变化编译成互动场景
6. 让用户以视觉小说方式进入故事、做选择、触发结果、到达不同结局

## 与现有产品形态的区别
### 与普通视觉小说的区别
- 普通视觉小说的角色、规则、分支通常都是人工预设的
- 本产品要先自动从原著中提炼角色卡与世界书，再生成互动结构

### 与 SillyTavern 的区别
- SillyTavern 的核心是角色卡 + 世界书 + 对话上下文增强
- 本产品要在此基础上增加：
  - 显式状态管理
  - 显式规则管理
  - 条件判断
  - 事件触发
  - 长期后果追踪
  - 多结局互动叙事

也就是说：
- `角色卡和世界书` 是素材层
- `状态与规则引擎` 是推演层
- `互动视觉小说` 是体验层

同时我们会明确借鉴 SillyTavern 已经被验证有效的两类能力：
- `角色卡可嵌入世界书`
- `世界书条目不是静态注释，而是可被上下文激活的执行型 lore`

但在本产品里，世界书的激活结果不会直接替代规则系统，而是先进入：
- `scene_prelude`
- `rules_guard`
- `codex_only`

再分别服务于叙事生成、规则说明与阅读器展示。

## 非目标
- 首版不做社区、书库、账号体系、云同步
- 首版不支持 epub / docx / pdf
- 首版不做本地模型优先策略
- 首版不做大规模 AI 图像生成工作流
- 首版不做完全自由的沙盒式文字冒险

## 核心概念
### 1. 角色卡 Character Card
角色卡用于保存角色的静态信息与可追踪状态。

静态信息包括：
- 姓名
- 性别
- 年龄
- 身份
- 阵营
- 角色定位
- 动机
- 秘密
- 能力

可变状态包括：
- 身体状态
- 情绪状态
- 好感 / 信任
- 与其他角色的关系状态
- 是否参与某个关键事件
- 是否拥有某条事实或秘密

### 2. 世界书 World Book
世界书不是单纯的背景文本集合，而是故事世界的知识层。

分为两类：
- `说明型条目`
  - 地点背景
  - 组织设定
  - 风俗、历史、常识
  - 人物关系补充
- `规则型条目`
  - 社会规则
  - 生理规则
  - 魔法 / 超自然规则
  - 禁忌
  - 触发条件

世界书的作用有两个：
- 为叙事生成提供上下文
- 为规则引擎提供世界约束

首版世界书条目必须支持“可执行激活”能力，而不是只有标题和正文。

每个条目至少要支持：
- 主关键词 `keys`
- 次关键词 `secondary_keys`
- 次关键词逻辑 `selective_logic`
- 常驻激活 `constant`
- 递归控制 `exclude_recursion` / `prevent_recursion` / `delay_until_recursion`
- 扫描范围 `scan_depth`
- 匹配选项 `case_sensitive` / `match_whole_words`
- 生命周期 `sticky` / `cooldown` / `delay`
- 触发类型 `triggers`
- 预算豁免 `ignore_budget`

这意味着世界书本质上是一组“按上下文触发的知识规则单元”。

### 2.1 复合扫描缓冲区 Composite Scan Buffer
参考 SillyTavern 的世界书扫描思路，我们的激活输入不应只看“当前一段文本”，而要看一个复合缓冲区。

首版缓冲区建议由以下部分组成：
- 当前场景摘要
- 当前场景正文
- 当前章节标题
- 当前出场角色摘要
- 最近关键选择
- 最近一次自由输入
- 已知事实摘要
- 已激活 lore 的递归缓冲区

这样做的意义是：
- 世界书能被“正在发生什么”激活
- 世界书也能被“用户刚刚做了什么”激活
- 递归 lore 可以补充下一层隐藏设定，但仍受预算与递归规则约束

### 3. 状态 State
状态用于描述“当前这个世界此刻成立的事实”。

例如：
- A 与 B 曾经发生过关系
- A 已经知道某个秘密
- 北门已经被打开过
- 某人已经死亡
- 某个角色存在怀孕可能

状态必须是结构化的，而不是散落在叙事文本里。

### 4. 规则 Rule
规则用于描述“如果满足某些条件，会得到什么结果”。

规则由三部分组成：
- 条件
- 约束 / 判断
- 结果

例如：
- `male + male -> cannot_conceive`
- `male + female + sexual_relation -> conception_possible`
- `open_north_gate_at_midnight -> forbidden`
- `betrayal + low_trust -> relationship_break`

规则必须显式存在于系统中，不能完全依赖 AI 临场推断。

### 5. 互动场景 Scene
互动场景是用户真正游玩的单位。

每个场景包含：
- 当前叙事文本
- 角色发言
- 当前激活的世界书条目
- 当前规则守卫摘要
- 可选行动
- 可能写入的状态变化
- 进入该场景所需的前置条件

这里的“当前激活的世界书条目”要进一步区分为三种运行时槽位：
- `scene_prelude`：提供给当前场景演出生成的背景事实
- `rules_guard`：提供给规则判断与解释层的约束摘要
- `codex_only`：只展示在阅读器侧栏，不直接参与本轮演出文本

## 系统总架构
系统分为五层。

### 第一层：小说提炼层
职责：
- 清洗原文
- 切分章节
- 抽取角色
- 抽取地点
- 抽取时间线
- 抽取关系
- 抽取关键事件
- 抽取原著规则

输出：
- `StoryBible`
- `CharacterCard[]`
- `WorldBookEntry[]`
- `TimelineEntry[]`
- `RelationshipEdge[]`
- `RuleDefinition[]`

### 第二层：世界模型层
职责：
- 把提炼结果转成可计算对象
- 建立角色、规则、事实、事件之间的统一结构
- 提供编辑和修正入口

输出：
- `WorldModel`

其中 `WorldModel` 由以下部分组成：
- 角色卡集合
- 世界书条目集合
- 规则集合
- 初始事实集合
- 初始故事状态

### 第三层：状态与规则引擎
职责：
- 接收当前状态与用户行为
- 校验行为是否合法
- 应用状态变化
- 触发规则
- 计算长期后果
- 生成新的世界状态

这是首版最重要的能力之一，也是与 SillyTavern 最大的分界线。

这里要特别强调：
- 世界书负责“哪些 lore 在这一刻应该生效”
- 规则引擎负责“这些 lore 与显式规则如何约束状态变化”
- 文本生成只能消费前两层的结果，不能绕过它们

### 第四层：互动编译层
职责：
- 根据 `WorldModel` 和原著主线生成场景图
- 把规则和状态变化编译到场景与选项里
- 生成多结局骨架
- 为运行时提供可读取的 `StoryPackage`

### 第五层：互动游戏层
职责：
- 把运行时状态呈现为视觉小说体验
- 提供选项、自由输入、回溯、结局总结
- 展示当前角色状态、关系变化、规则摘要和活跃 lore

## 关键数据对象
### StoryBible
原著结构化摘要，是中间抽取层，而不是最终运行时对象。

包含：
- characters
- locations
- timeline
- world_rules
- relationships
- core_conflicts
- extracted_events

### CharacterCard
包含：
- id
- name
- gender
- age
- identity
- faction
- role
- summary
- desire
- secrets
- traits
- abilities
- mutable_state

### WorldBookEntry
包含：
- id
- title
- category
- content
- enabled
- keys
- secondary_keys
- selective_logic
- constant
- recursive
- exclude_recursion
- prevent_recursion
- delay_until_recursion
- scan_depth
- case_sensitive
- match_whole_words
- sticky
- cooldown
- delay
- triggers
- ignore_budget
- order
- insertion_mode
- source
- rule_binding

其中 `category` 至少包括：
- character
- location
- social_rule
- biology_rule
- supernatural_rule
- organization
- event_memory
- miscellaneous

### RuleDefinition
包含：
- id
- name
- category
- priority
- enabled
- conditions
- blockers
- effects
- explanation

### FactRecord
包含：
- id
- subject
- predicate
- object
- value
- timestamp
- source

### StoryState
包含：
- current_scene_id
- character_states
- fact_records
- relationship_states
- event_flags
- possibility_flags
- unlocked_rules
- visited_scenes
- checkpoints
- ending_report

## 规则系统设计
### 规则分类
首版规则系统建议至少分为四类：

1. `硬规则`
- 违反即不允许进入结果
- 例如：午夜后不能开北门

2. `生理规则`
- 与性别、身体、繁殖、疾病、寿命相关
- 例如：两个男性不能自然生育

3. `社会规则`
- 与礼法、身份、阵营、组织约束相关
- 例如：某身份不能公开做某件事

4. `剧情规则`
- 用于保证主线结构、秘密解锁顺序和关键事件前后因果
- 例如：未知道真相前不能进入某结局

### 规则执行原则
- 显式规则优先
- AI 推断为辅
- 状态判断先于文本生成
- 不允许叙事文本绕过规则引擎直接写出结果

### 示例
规则示例 1：
- 条件：`subject.gender == male && object.gender == male && relation == sexual_relation`
- 结果：`set possibility.conception = false`

规则示例 2：
- 条件：`subject.gender == male && object.gender == female && relation == sexual_relation`
- 结果：`set possibility.conception = true`

规则示例 3：
- 条件：`event == open_gate && gate == north && time == midnight`
- 结果：`forbidden = true`

## 运行时流程
用户每次推进剧情时，系统按以下顺序运行：

1. 读取当前场景
2. 收集当前状态
3. 构建复合扫描缓冲区
4. 根据当前场景文本、已知事实、最近行为激活世界书条目
5. 按 `scene_prelude`、`rules_guard`、`codex_only` 分类活跃 lore
6. 让用户做出选项或自由输入
7. 把用户行为翻译成结构化 action
8. 先交给规则引擎判断是否合法
9. 更新状态与事实记录
10. 触发规则结果与潜在后果
11. 选择下一场景
12. 由 AI 生成或补全该场景的叙事演出文本
13. 更新角色状态面板、关系面板、规则摘要和 checkpoint

其中第 4 步的激活流程还必须遵守以下约束：
- 常驻条目先加入
- 关键词命中后再判断次关键词逻辑
- 命中的条目按 `order` 排序
- 条目受上下文预算限制
- 允许递归激活，但递归层数与延迟层级受控
- 带 `sticky` / `cooldown` / `delay` 的条目要进入会话级效果管理

这些机制用于保证世界书不是“一次性抽卡”，而是能跨场景产生持续影响。

## 用户体验结构
### 1. 导入与提炼阶段
用户需要看到：
- 小说已导入
- 角色卡正在生成
- 世界书正在生成
- 规则与状态模型正在编译
- 场景图正在编译

### 2. 世界模型审阅阶段
在正式进入游戏前，首版建议允许用户查看并轻量修正：
- 角色卡
- 世界书
- 关键规则

这一步非常重要，因为如果提炼结果不准确，后续游戏体验会整体跑偏。

### 3. 游戏阶段
核心界面应由三部分组成：
- 主舞台：叙事文本与对白
- 侧栏一：角色 / 关系 / 时间线 / 最近选择
- 侧栏二：世界书 / 规则 / 当前活跃 lore / 状态变化

其中“当前活跃 lore”不只是展示列表，而要可区分：
- 为什么它被激活
- 它进入了哪个运行时槽位
- 它是否处于 `sticky` / `cooldown` / `delay` 状态

## 前后端职责
### Rust 后端
负责：
- 小说导入与切分
- 提炼流程
- 世界模型生成
- 规则定义与执行
- 事实记录
- 场景运行时
- 本地持久化

### SvelteKit 前端
负责：
- 导入页面
- 提炼进度页面
- 角色卡与世界书审阅界面
- 游戏舞台
- 规则与状态可视化
- 结局与回溯

## 命令接口方向
现有命令接口需要扩展为三组：

### 项目与构建
- `create_project`
- `import_novel_text`
- `build_story_package`
- `get_build_status`

### 世界模型
- `get_character_cards`
- `update_character_card`
- `get_worldbook`
- `upsert_worldbook_entry`
- `delete_worldbook_entry`
- `get_rules`
- `upsert_rule`
- `delete_rule`
- `preview_active_worldbook`
- `preview_rule_evaluation`

### 游戏运行时
- `start_session`
- `get_current_scene`
- `submit_choice`
- `submit_free_input`
- `get_story_codex`
- `get_story_state`
- `rewind_to_checkpoint`
- `finish_session`

## 首版实施优先级
第一版建议严格分三阶段：

### Phase 1：结构化提炼
目标：
- 稳定产出角色卡、世界书、时间线、关系网、规则草案

### Phase 2：规则与状态引擎
目标：
- 让故事世界变成“可计算的系统”
- 能记录状态、判断约束、触发结果

### Phase 3：互动视觉小说层
目标：
- 让用户真正玩起来
- 让每次选择都经过规则引擎
- 让结局由状态和规则共同决定

## 验收标准
满足以下条件才算达到本设计的 v1 目标：

1. 导入一本中文小说后，系统能生成非空的角色卡集合
2. 系统能生成非空的世界书条目集合
3. 系统能生成显式规则集合，而不是只输出说明文本
4. 系统能记录世界状态和角色状态
5. 用户选择后，结果先经过规则判断再进入剧情
6. 用户能在阅读器里看到当前活跃 lore、状态变化和关键规则摘要
7. 故事至少支持一条主线和多个结局
8. 至少存在一个可验证的规则案例，例如：
   - 不可能的生育关系被阻止
   - 合法关系触发“可能怀孕”状态

## 当前文档与后续计划关系
这份设计文档是接下来实施计划的上位约束。

后续实施计划必须围绕四个核心对象展开：
- `CharacterCard`
- `WorldBookEntry`
- `RuleDefinition`
- `StoryState`

不能再把世界书当成唯一重点，也不能跳过规则/状态层直接做互动运行时。
