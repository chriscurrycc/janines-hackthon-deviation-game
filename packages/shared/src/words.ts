import type { Category } from './types'

// Word decks. Single source of truth for both apps (web shows them; realtime picks rounds).
export const categories: Category[] = [
  {
    id: 'creature',
    label: '生物',
    words: ['狗', '猫', '羊', '兔子', '大象', '老虎', '企鹅', '螃蟹', '章鱼', '蜗牛', '刺猬', '猫头鹰', '鲸鱼', '蝙蝠', '恐龙'],
  },
  {
    id: 'object',
    label: '物品',
    words: ['雨伞', '椅子', '杯子', '眼镜', '灯泡', '剪刀', '钥匙', '闹钟', '吉他', '雪糕', '皇冠', '火箭', '信封', '水龙头', '热气球'],
  },
  {
    id: 'food',
    label: '食物',
    words: ['披萨', '汉堡', '寿司', '西瓜', '甜甜圈', '棒棒糖', '煎蛋', '辣椒', '菠萝', '饺子', '爆米花', '三明治', '蛋糕', '面条', '烤串'],
  },
  {
    id: 'action',
    label: '动作',
    words: ['睡觉', '跑步', '唱歌', '钓鱼', '拍照', '划船', '放风筝', '打喷嚏', '举重', '滑雪', '跳舞', '思考', '拥抱', '投篮', '弹钢琴'],
  },
]

export function findCategory(id: string): Category {
  return categories.find((c) => c.id === id) ?? categories[0]
}
