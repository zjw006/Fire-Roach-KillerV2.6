$ErrorActionPreference = "Stop"
$base = "d:\CocosGreater\Fire Roach KillerV2.6\app\src\game\engine"

function Replace-InFile {
    param($Path, $Old, $New)
    $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    if ($content.Contains($Old)) {
        $content = $content.Replace($Old, $New)
        [System.IO.File]::WriteAllText($Path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  OK: $Old -> $New"
    } else {
        Write-Host "  SKIP (not found): $Old"
    }
}

# ============================================================
# 1. RoachAISystem.ts
# ============================================================
Write-Host "`n=== RoachAISystem.ts ===" -ForegroundColor Cyan
$f = "$base\ai\RoachAISystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_GROUND_BOUNDS, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_GROUND_BOUNDS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'女王召唤了小蟑螂!'" "TEXT_CONFIG.combat.queenSummon"
Replace-InFile $f "'炸弹已安放!'" "TEXT_CONFIG.combat.bombPlaced"
Replace-InFile $f "'变身大蟑螂!'" "TEXT_CONFIG.combat.transformBig"
Replace-InFile $f "'【施法中】'" "TEXT_CONFIG.combat.nurseCasting"
Replace-InFile $f "'非法行医!'" "TEXT_CONFIG.combat.nurseIllegal"
Replace-InFile $f "'治疗喷射!'" "TEXT_CONFIG.combat.nurseSpray"
Replace-InFile $f "'炸弹没响...'" "TEXT_CONFIG.combat.bombFailed"
Replace-InFile $f "'護盾抵消!'" "TEXT_CONFIG.combat.shieldBlock"
Replace-InFile $f "'BOSS 击败!'" "TEXT_CONFIG.combat.bossDefeated"
Replace-InFile $f "'尸体炸弹 3秒!'" "TEXT_CONFIG.combat.corpseBomb(BALANCE_CONFIG.roachAI.bombCountdown)"
Replace-InFile $f "'【胚胎暴走】'" "TEXT_CONFIG.combat.embryoBurst"
Replace-InFile $f "'酸液飞溅!'" "TEXT_CONFIG.combat.acidSplash"
Replace-InFile $f "'轰!'" "TEXT_CONFIG.combat.boom"
Replace-InFile $f "'分裂x5!'" "TEXT_CONFIG.combat.splitSpawn"
Replace-InFile $f "'解体!'" "TEXT_CONFIG.combat.disintegrate"
Replace-InFile $f "`大爆炸!(`$\{hitCount}只受波及)`" "TEXT_CONFIG.combat.bigExplosion(hitCount)"
Replace-InFile $f "`死亡爆炸!(`$\{hitCount}只受波及)`" "TEXT_CONFIG.combat.deathExplosion(hitCount)"
Replace-InFile $f "`爆炸!(`$\{hitCount}只受波及)`" "TEXT_CONFIG.combat.explode(hitCount)"
Replace-InFile $f "'大爆炸!'" "TEXT_CONFIG.combat.bigExplosion(0)"
Replace-InFile $f "'死亡爆炸!'" "TEXT_CONFIG.combat.deathExplosion(0)"
Replace-InFile $f "'爆炸!'" "TEXT_CONFIG.combat.explode(0)"
Replace-InFile $f "`+¥`$\{reward}`" "TEXT_CONFIG.combat.killReward(reward)"
Replace-InFile $f "`$\{hitCount}只受腐蚀" "TEXT_CONFIG.combat.acidCorrode(hitCount)"

# ============================================================
# 2. BossBattleSystem.ts
# ============================================================
Write-Host "`n=== BossBattleSystem.ts ===" -ForegroundColor Cyan
$f = "$base\boss\BossBattleSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'第一波:虫卵'" "TEXT_CONFIG.combat.bossPhase1"
Replace-InFile $f "'【螂老大来袭】'" "TEXT_CONFIG.combat.bossAppearTitle"
Replace-InFile $f "'消灭虫卵和蟑螂!保卫防线!'" "TEXT_CONFIG.combat.bossDefendLine"
Replace-InFile $f "'螂老大出现了!'" "TEXT_CONFIG.combat.bossAppear"
Replace-InFile $f "'它正在产卵!消灭虫卵!'" "TEXT_CONFIG.combat.bossSpawnEggs"
Replace-InFile $f "'螂老大被消灭了!'" "TEXT_CONFIG.combat.bossDefeatedText"
Replace-InFile $f "'胜利!'" "TEXT_CONFIG.combat.victory"
Replace-InFile $f "'BOSS正在召唤虫卵...'" "TEXT_CONFIG.combat.bossSummoning"
Replace-InFile $f "'召唤虫卵!'" "TEXT_CONFIG.combat.bossSummon"
Replace-InFile $f "'不...不可能!我的虫卵大军...'" "TEXT_CONFIG.combat.bossDialogueShort"
Replace-InFile $f "'螂老大: \`"不...不可能!\`"'" "TEXT_CONFIG.combat.bossDialogue1"
Replace-InFile $f "'螂老大: \`"我的虫卵大军...全灭了...\`"'" "TEXT_CONFIG.combat.bossDialogue2"
Replace-InFile $f "'螂老大: \`"这次算你赢了!我会回来的!\`"'" "TEXT_CONFIG.combat.bossDialogue3"
Replace-InFile $f "'螂老大飞走了...'" "TEXT_CONFIG.combat.bossFlee"
Replace-InFile $f "'准备中'" "TEXT_CONFIG.combat.preparing"
Replace-InFile $f "'BOSS逃跑中'" "TEXT_CONFIG.combat.bossFleeing"
Replace-InFile $f "`第`$\{bb.currentWave}波清除!`" "TEXT_CONFIG.combat.waveClearedN(bb.currentWave)"

# ============================================================
# 3. CollisionSystem.ts
# ============================================================
Write-Host "`n=== CollisionSystem.ts ===" -ForegroundColor Cyan
$f = "$base\collision\CollisionSystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BOSS_CONFIG, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BOSS_CONFIG, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'护盾抵消!'" "TEXT_CONFIG.combat.shieldBlock"
Replace-InFile $f "'防线突破!'" "TEXT_CONFIG.combat.defenseBreach"
Replace-InFile $f "'护甲碎裂!'" "TEXT_CONFIG.combat.armorShatter"
Replace-InFile $f "'破甲!'" "TEXT_CONFIG.combat.armorBreak"

# ============================================================
# 4. ConsumableSystem.ts
# ============================================================
Write-Host "`n=== ConsumableSystem.ts ===" -ForegroundColor Cyan
$f = "$base\consumable\ConsumableSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'燃气已回满!'" "TEXT_CONFIG.combat.gasRefill"
Replace-InFile $f "'>>> 蟑螂诱饵已投放 <<<'" "TEXT_CONFIG.combat.baitPlaced"
Replace-InFile $f "'火力全开 结束'" "TEXT_CONFIG.combat.powerBoostEnd"
Replace-InFile $f "'防线护盾 消失'" "TEXT_CONFIG.combat.shieldEnd"
Replace-InFile $f "'诱饵效果 消失'" "TEXT_CONFIG.combat.baitEnd"

# ============================================================
# 5. FanSystem.ts
# ============================================================
Write-Host "`n=== FanSystem.ts ===" -ForegroundColor Cyan
$f = "$base\fan\FanSystem.ts"
Replace-InFile $f "import { RoachType, RoachState } from '../../types';" "import { RoachType, RoachState } from '../../types';`r`nimport { TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'蟑螂被吹退8秒!'" "TEXT_CONFIG.combat.fanDesc"
Replace-InFile $f "'强力风扇启动!'" "TEXT_CONFIG.combat.fanActivate"
Replace-InFile $f "'风扇停止'" "TEXT_CONFIG.combat.fanStop"
Replace-InFile $f "'吹退中'" "TEXT_CONFIG.combat.fanBlowing"

# ============================================================
# 6. InsecticideSystem.ts
# ============================================================
Write-Host "`n=== InsecticideSystem.ts ===" -ForegroundColor Cyan
$f = "$base\insecticide\InsecticideSystem.ts"
Replace-InFile $f "import { type InsecticideSprayState } from '../render/RenderUtils';" "import { type InsecticideSprayState } from '../render/RenderUtils';`r`nimport { TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'双侧毒气喷射!'" "TEXT_CONFIG.combat.insecticideActivate"
Replace-InFile $f "'两侧横向毒雾3秒'" "TEXT_CONFIG.combat.insecticideDesc"
Replace-InFile $f "'毒气喷射即将结束!'" "TEXT_CONFIG.combat.insecticideClosing"
Replace-InFile $f "'毒气喷射结束'" "TEXT_CONFIG.combat.insecticideEnd"
Replace-InFile $f "'护甲免疫!'" "TEXT_CONFIG.combat.armorImmune"
Replace-InFile $f "`毒气命中`$\{hitCount}只!`" "TEXT_CONFIG.combat.insecticideHit(hitCount)"

# ============================================================
# 7. PoisonSystem.ts
# ============================================================
Write-Host "`n=== PoisonSystem.ts ===" -ForegroundColor Cyan
$f = "$base\poison\PoisonSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'毒雾!'" "TEXT_CONFIG.combat.poisonLand"
Replace-InFile $f "`毒雾!(`$\{hitCount}只)`" "TEXT_CONFIG.combat.poisonHit(hitCount)"

# ============================================================
# 8. RadarLaserSystem.ts
# ============================================================
Write-Host "`n=== RadarLaserSystem.ts ===" -ForegroundColor Cyan
$f = "$base\radar\RadarLaserSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'雷达激光启动! 自动追踪目标'" "TEXT_CONFIG.combat.radarActivate"
Replace-InFile $f "'5发激光，伤害与小蟑螂一致'" "TEXT_CONFIG.combat.radarDesc"
Replace-InFile $f "'雷达激光即将关闭!'" "TEXT_CONFIG.combat.radarClosing"
Replace-InFile $f "'雷达激光关闭'" "TEXT_CONFIG.combat.radarClosed"
Replace-InFile $f "'激光发射完毕!'" "TEXT_CONFIG.combat.radarExhausted"
Replace-InFile $f "'激光击杀!'" "TEXT_CONFIG.combat.radarKill"

# ============================================================
# 9. StickySystem.ts
# ============================================================
Write-Host "`n=== StickySystem.ts ===" -ForegroundColor Cyan
$f = "$base\sticky\StickySystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'蟑螂贴板发射!'" "TEXT_CONFIG.combat.stickyLaunch"
Replace-InFile $f "'10个追踪水滴'" "TEXT_CONFIG.combat.stickyTracking"
Replace-InFile $f "'护甲免疫'" "TEXT_CONFIG.combat.armorImmune"
Replace-InFile $f "'粘住12秒!'" "TEXT_CONFIG.combat.stickyCapture"
Replace-InFile $f "'贴板!'" "TEXT_CONFIG.combat.stickyBoard"
Replace-InFile $f "'粘住!'" "TEXT_CONFIG.combat.stickyStuck"

# ============================================================
# 10. SwatterSystem.ts
# ============================================================
Write-Host "`n=== SwatterSystem.ts ===" -ForegroundColor Cyan
$f = "$base\swatter\SwatterSystem.ts"
Replace-InFile $f "import { WEAPON_DROP_DEFS, BALANCE_CONFIG } from '../../data';" "import { WEAPON_DROP_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'⚡ 电蚊拍就绪!'" "TEXT_CONFIG.combat.swatterReady"
Replace-InFile $f "'没有电蚊拍!'" "TEXT_CONFIG.combat.swatterNoItem"
Replace-InFile $f "'⚡电蚊拍!未命中'" "TEXT_CONFIG.combat.swatterMiss"
Replace-InFile $f "'获得电蚊拍!'" "TEXT_CONFIG.combat.swatterPickup"

# ============================================================
# 11. ThrowableSystem.ts
# ============================================================
Write-Host "`n=== ThrowableSystem.ts ===" -ForegroundColor Cyan
$f = "$base\throwable\ThrowableSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'冰冻!'" "TEXT_CONFIG.combat.stickyLand"
Replace-InFile $f "'毒雾!'" "TEXT_CONFIG.combat.poisonLand"
Replace-InFile $f "'燃烧!'" "TEXT_CONFIG.combat.molotovLand"

# ============================================================
# 12. WaveManager.ts
# ============================================================
Write-Host "`n=== WaveManager.ts ===" -ForegroundColor Cyan
$f = "$base\wave\WaveManager.ts"
Replace-InFile $f "import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES, BALANCE_CONFIG } from '../../data';" "import { SCENE_WAVE_CONFIGS, SCENE_ROACH_TYPES, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'支援单位已清除，推进下一波!'" "TEXT_CONFIG.combat.waveCleared"

# ============================================================
# 13. WeatherSystem.ts
# ============================================================
Write-Host "`n=== WeatherSystem.ts ===" -ForegroundColor Cyan
$f = "$base\weather\WeatherSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'⚡ 闪电 ⚡'" "TEXT_CONFIG.combat.lightning"

# ============================================================
# 14. TripleFlameSystem.ts
# ============================================================
Write-Host "`n=== TripleFlameSystem.ts ===" -ForegroundColor Cyan
$f = "$base\tripleFlame\TripleFlameSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'三喷火枪模式! 持续10秒'" "TEXT_CONFIG.combat.tripleFlameActivate"
Replace-InFile $f "'⚠ 三喷火枪即将消失! 5秒 ⚠'" "TEXT_CONFIG.combat.tripleFlameWarning"
Replace-InFile $f "'三喷火枪模式结束'" "TEXT_CONFIG.combat.tripleFlameEnd"

# ============================================================
# 15. RenderUtils.ts
# ============================================================
Write-Host "`n=== RenderUtils.ts ===" -ForegroundColor Cyan
$f = "$base\render\RenderUtils.ts"
Replace-InFile $f "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_CONFIGS, SCENE_GROUND_BOUNDS, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_CONFIGS, SCENE_GROUND_BOUNDS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'防 线'" "TEXT_CONFIG.combat.defenseLine"
Replace-InFile $f "'蟑螂地面边界(6点折线)'" "TEXT_CONFIG.combat.groundBounds"

# ============================================================
# 16. RoachRenderer.ts
# ============================================================
Write-Host "`n=== RoachRenderer.ts ===" -ForegroundColor Cyan
$f = "$base\render\RoachRenderer.ts"
Replace-InFile $f "'蟑螂女王'" "TEXT_CONFIG.combat.roachQueen"

# ============================================================
# 17. AimingSystem.ts
# ============================================================
Write-Host "`n=== AimingSystem.ts ===" -ForegroundColor Cyan
$f = "$base\aiming\AimingSystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
# Replace local names object with TEXT_CONFIG items
Replace-InFile $f "'蟑螂贴板'" "TEXT_CONFIG.items.sticky"
Replace-InFile $f "'杀虫剂'" "TEXT_CONFIG.items.poison"
Replace-InFile $f "'燃烧瓶'" "TEXT_CONFIG.items.molotov"

Write-Host "`n=== ALL DONE ===" -ForegroundColor Green