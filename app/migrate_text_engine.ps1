$ErrorActionPreference = "Stop"
$base = "d:\CocosGreater\Fire Roach KillerV2.6\app\src\game\engine"

function Replace-InFile {
    param($Path, $Old, $New)
    $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    if ($content.Contains($Old)) {
        $content = $content.Replace($Old, $New)
        [System.IO.File]::WriteAllText($Path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  OK: $($Old.Substring(0, [Math]::Min(40, $Old.Length)))... -> $New"
    } else {
        Write-Host "  SKIP (not found): $($Old.Substring(0, [Math]::Min(40, $Old.Length)))..."
    }
}

# ===================================================================
# RoachAISystem.ts
# ===================================================================
Write-Host "`n=== RoachAISystem.ts ===" -ForegroundColor Cyan
$f = "$base\ai\RoachAISystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_GROUND_BOUNDS } from '../../data';" "import { ENEMY_DEFS, BOSS_CONFIG, SCENE_GROUND_BOUNDS, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'女王召唤了小蟑螂!'" "TEXT_CONFIG.combat.queenSummon"
Replace-InFile $f "'炸弹已安放!'" "TEXT_CONFIG.combat.bombPlaced"
Replace-InFile $f "'变身大蟑螂!'" "TEXT_CONFIG.combat.transformBig"
Replace-InFile $f "'【施法中】'" "TEXT_CONFIG.combat.nurseCasting"
Replace-InFile $f "'非法行医!'" "TEXT_CONFIG.combat.nurseIllegal"
Replace-InFile $f "'治疗喷射!'" "TEXT_CONFIG.combat.nurseSpray"
Replace-InFile $f "'炸弹没响...'" "TEXT_CONFIG.combat.bombFailed"
Replace-InFile $f "'BOSS 击败!'" "TEXT_CONFIG.combat.bossDefeated"
Replace-InFile $f "'尸体炸弹 3秒!'" "TEXT_CONFIG.combat.corpseBomb(3)"
Replace-InFile $f "'【胚胎暴走】'" "TEXT_CONFIG.combat.embryoBurst"
Replace-InFile $f "'酸液飞溅!'" "TEXT_CONFIG.combat.acidSplash"
Replace-InFile $f "'轰!'" "TEXT_CONFIG.combat.boom"
Replace-InFile $f "'分裂x5!'" "TEXT_CONFIG.combat.splitSpawn"
Replace-InFile $f "'解体!'" "TEXT_CONFIG.combat.disintegrate"
Replace-InFile $f "`大爆炸!(`$" + "{hitCount}只受波及)`" "TEXT_CONFIG.combat.bigExplosion(hitCount)"
Replace-InFile $f "`死亡爆炸!(`$" + "{hitCount}只受波及)`" "TEXT_CONFIG.combat.deathExplosion(hitCount)"
Replace-InFile $f "`爆炸!(`$" + "{hitCount}只受波及)`" "TEXT_CONFIG.combat.explode(hitCount)"
Replace-InFile $f "`+¥`$" + "{reward}`" "TEXT_CONFIG.combat.killReward(reward)"
Replace-InFile $f "`$" + "{hitCount}只受腐蚀" "TEXT_CONFIG.combat.acidCorrode(hitCount)"
Replace-InFile $f "`生成`$" + "{spawnedCount}只!" "TEXT_CONFIG.combat.spawnCount(spawnedCount)"
Replace-InFile $f "`【诞生】`$" + "{typeName}!" "`【诞生】`$" + "{typeName}!"
Replace-InFile $f "'护盾抵消!'" "TEXT_CONFIG.combat.shieldBlock"

# ===================================================================
# BossBattleSystem.ts
# ===================================================================
Write-Host "`n=== BossBattleSystem.ts ===" -ForegroundColor Cyan
$f = "$base\boss\BossBattleSystem.ts"
Replace-InFile $f "import { BOSS_ANIMATIONS } from '../../bossAnimation';" "import { BOSS_ANIMATIONS } from '../../bossAnimation';`nimport { TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'螂老大出现了!'" "TEXT_CONFIG.combat.bossAppear"
Replace-InFile $f "'它正在产卵!消灭虫卵!'" "TEXT_CONFIG.combat.bossSpawnEggs"
Replace-InFile $f "'螂老大被消灭了!'" "TEXT_CONFIG.combat.bossDefeatedText"
Replace-InFile $f "'胜利!'" "TEXT_CONFIG.combat.victory"
Replace-InFile $f "'召唤虫卵!'" "TEXT_CONFIG.combat.bossSummon"
Replace-InFile $f "'螂老大: \`"不...不可能!\`"'" "TEXT_CONFIG.combat.bossDialogue1"
Replace-InFile $f "'螂老大: \`"我的虫卵大军...全灭了...\`"'" "TEXT_CONFIG.combat.bossDialogue2"
Replace-InFile $f "'螂老大: \`"这次算你赢了!我会回来的!\`"'" "TEXT_CONFIG.combat.bossDialogue3"
Replace-InFile $f "'螂老大飞走了...'" "TEXT_CONFIG.combat.bossFlee"
Replace-InFile $f "'第一波:虫卵'" "TEXT_CONFIG.combat.bossPhase1"
Replace-InFile $f "'【螂老大来袭】'" "TEXT_CONFIG.combat.bossAppearTitle"
Replace-InFile $f "'消灭虫卵和蟑螂!保卫防线!'" "TEXT_CONFIG.combat.bossDefendLine"
Replace-InFile $f "'不...不可能!我的虫卵大军...'" "TEXT_CONFIG.combat.bossDialogueShort"
Replace-InFile $f "'BOSS正在召唤虫卵...'" "TEXT_CONFIG.combat.bossSummoning"
Replace-InFile $f "'准备中'" "TEXT_CONFIG.combat.preparing"
Replace-InFile $f "'BOSS逃跑中'" "TEXT_CONFIG.combat.bossFleeing"

# ===================================================================
# ConsumableSystem.ts
# ===================================================================
Write-Host "`n=== ConsumableSystem.ts ===" -ForegroundColor Cyan
$f = "$base\consumable\ConsumableSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'燃气已回满!'" "TEXT_CONFIG.combat.gasRefill"
Replace-InFile $f "'>>> 蟑螂诱饵已投放 <<<'" "TEXT_CONFIG.combat.baitPlaced"
Replace-InFile $f "'诱饵效果 消失'" "TEXT_CONFIG.combat.baitEnd"
Replace-InFile $f "'火力全开 结束'" "TEXT_CONFIG.combat.powerBoostEnd"
Replace-InFile $f "'防线护盾 消失'" "TEXT_CONFIG.combat.shieldEnd"
Replace-InFile $f "`>>> 火力全开 `$" + "{BALANCE_CONFIG.consumable.powerBoostDuration}秒 <<<`" "TEXT_CONFIG.combat.powerBoost(BALANCE_CONFIG.consumable.powerBoostDuration)"
Replace-InFile $f "`>>> 防线护盾 `$" + "{BALANCE_CONFIG.consumable.shieldDuration}秒 <<<`" "TEXT_CONFIG.combat.shieldActive(BALANCE_CONFIG.consumable.shieldDuration)"

# ===================================================================
# FanSystem.ts
# ===================================================================
Write-Host "`n=== FanSystem.ts ===" -ForegroundColor Cyan
$f = "$base\fan\FanSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'强力风扇启动!'" "TEXT_CONFIG.combat.fanActivate"
Replace-InFile $f "'蟑螂被吹退8秒!'" "TEXT_CONFIG.combat.fanDesc"
Replace-InFile $f "'风扇停止'" "TEXT_CONFIG.combat.fanStop"
Replace-InFile $f "'吹退中'" "TEXT_CONFIG.combat.fanBlowing"

# ===================================================================
# InsecticideSystem.ts
# ===================================================================
Write-Host "`n=== InsecticideSystem.ts ===" -ForegroundColor Cyan
$f = "$base\insecticide\InsecticideSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'双侧毒气喷射!'" "TEXT_CONFIG.combat.insecticideActivate"
Replace-InFile $f "'两侧横向毒雾3秒'" "TEXT_CONFIG.combat.insecticideDesc"
Replace-InFile $f "'毒气喷射即将结束!'" "TEXT_CONFIG.combat.insecticideClosing"
Replace-InFile $f "'毒气喷射结束'" "TEXT_CONFIG.combat.insecticideEnd"
Replace-InFile $f "`毒气命中`$" + "{hitCount}只!" "TEXT_CONFIG.combat.insecticideHit(hitCount)"

# ===================================================================
# PoisonSystem.ts
# ===================================================================
Write-Host "`n=== PoisonSystem.ts ===" -ForegroundColor Cyan
$f = "$base\poison\PoisonSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'毒雾!'" "TEXT_CONFIG.combat.poisonLand"
Replace-InFile $f "'护甲免疫'" "TEXT_CONFIG.combat.armorImmune"

# ===================================================================
# RadarLaserSystem.ts
# ===================================================================
Write-Host "`n=== RadarLaserSystem.ts ===" -ForegroundColor Cyan
$f = "$base\radar\RadarLaserSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'雷达激光启动! 自动追踪目标'" "TEXT_CONFIG.combat.radarActivate"
Replace-InFile $f "'5发激光，伤害与小蟑螂一致'" "TEXT_CONFIG.combat.radarDesc"
Replace-InFile $f "'雷达激光即将关闭!'" "TEXT_CONFIG.combat.radarClosing"
Replace-InFile $f "'雷达激光关闭'" "TEXT_CONFIG.combat.radarClosed"
Replace-InFile $f "'激光发射完毕!'" "TEXT_CONFIG.combat.radarExhausted"
Replace-InFile $f "'激光击杀!'" "TEXT_CONFIG.combat.radarKill"
Replace-InFile $f "`激光 x`$" + "{this.radarLaser.shotsRemaining}`" "TEXT_CONFIG.combat.radarShot(this.radarLaser.shotsRemaining)"
Replace-InFile $f "`雷达激光 `$" + "{Math.ceil(this.radarLaser.timer)}秒...`" "TEXT_CONFIG.combat.radarCountdown(Math.ceil(this.radarLaser.timer))"

# ===================================================================
# StickySystem.ts
# ===================================================================
Write-Host "`n=== StickySystem.ts ===" -ForegroundColor Cyan
$f = "$base\sticky\StickySystem.ts"
Replace-InFile $f "import { ENEMY_DEFS, BALANCE_CONFIG } from '../../data';" "import { ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'蟑螂贴板发射!'" "TEXT_CONFIG.combat.stickyLaunch"
Replace-InFile $f "'10个追踪水滴'" "TEXT_CONFIG.combat.stickyTracking"
Replace-InFile $f "'粘住12秒!'" "TEXT_CONFIG.combat.stickyCapture"
Replace-InFile $f "'贴板!'" "TEXT_CONFIG.combat.stickyBoard"
Replace-InFile $f "'粘住!'" "TEXT_CONFIG.combat.stickyStuck"

# ===================================================================
# SwatterSystem.ts
# ===================================================================
Write-Host "`n=== SwatterSystem.ts ===" -ForegroundColor Cyan
$f = "$base\swatter\SwatterSystem.ts"
Replace-InFile $f "import { WEAPON_DROP_DEFS, BALANCE_CONFIG } from '../../data';" "import { WEAPON_DROP_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'⚡ 电蚊拍就绪!'" "TEXT_CONFIG.combat.swatterReady"
Replace-InFile $f "'没有电蚊拍!'" "TEXT_CONFIG.combat.swatterNoItem"
Replace-InFile $f "'获得电蚊拍!'" "TEXT_CONFIG.combat.swatterPickup"
Replace-InFile $f "'破甲!'" "TEXT_CONFIG.combat.armorBreak"
Replace-InFile $f "'⚡电蚊拍!未命中'" "TEXT_CONFIG.combat.swatterMiss"
Replace-InFile $f "`道具冷却中... (`$" + "{result.globalConsumableCooldown.toFixed(1)}s)`" "TEXT_CONFIG.combat.globalCooldown(result.globalConsumableCooldown.toFixed(1))"
Replace-InFile $f "`电蚊拍冷却中... (`$" + "{result.itemCooldowns['swatter'].toFixed(1)}s)`" "TEXT_CONFIG.combat.swatterCooldown(result.itemCooldowns['swatter'].toFixed(1))"
Replace-InFile $f "`⚡电蚊拍全屏!命中`$" + "{hitCount}只!破甲`$" + "{armorBreakCount}!" "TEXT_CONFIG.combat.swatterHit(hitCount, armorBreakCount)"
Replace-InFile $f "`⚡电蚊拍全屏!命中`$" + "{hitCount}只!麻痹!" "TEXT_CONFIG.combat.swatterHitParalyze(hitCount)"

# ===================================================================
# ThrowableSystem.ts
# ===================================================================
Write-Host "`n=== ThrowableSystem.ts ===" -ForegroundColor Cyan
$f = "$base\throwable\ThrowableSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'冰冻!'" "TEXT_CONFIG.combat.stickyLand"
Replace-InFile $f "'燃烧!'" "TEXT_CONFIG.combat.molotovLand"
Replace-InFile $f "'护甲免疫'" "TEXT_CONFIG.combat.armorImmune"

# ===================================================================
# TripleFlameSystem.ts
# ===================================================================
Write-Host "`n=== TripleFlameSystem.ts ===" -ForegroundColor Cyan
$f = "$base\triple\TripleFlameSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'三喷火枪模式! 持续10秒'" "TEXT_CONFIG.combat.tripleFlameActivate"
Replace-InFile $f "'⚠ 三喷火枪即将消失! 5秒 ⚠'" "TEXT_CONFIG.combat.tripleFlameWarning"
Replace-InFile $f "'三喷火枪模式结束'" "TEXT_CONFIG.combat.tripleFlameEnd"

# ===================================================================
# WaveManager.ts
# ===================================================================
Write-Host "`n=== WaveManager.ts ===" -ForegroundColor Cyan
$f = "$base\wave\WaveManager.ts"
Replace-InFile $f "import { SCENE_GROUND_BOUNDS, ENEMY_DEFS, BALANCE_CONFIG } from '../../data';" "import { SCENE_GROUND_BOUNDS, ENEMY_DEFS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'支援单位已清除，推进下一波!'" "TEXT_CONFIG.combat.waveCleared"
Replace-InFile $f "`第`$" + "{this.currentWave}波清除!" "TEXT_CONFIG.combat.waveClearedN(this.currentWave)"
Replace-InFile $f "'游戏胜利'" "TEXT_CONFIG.combat.gameVictory"
Replace-InFile $f "'倒计时3-2-1...'" "TEXT_CONFIG.combat.countdown"

# ===================================================================
# WeatherSystem.ts
# ===================================================================
Write-Host "`n=== WeatherSystem.ts ===" -ForegroundColor Cyan
$f = "$base\weather\WeatherSystem.ts"
Replace-InFile $f "import { BALANCE_CONFIG } from '../../data';" "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
Replace-InFile $f "'⚡ 闪电 ⚡'" "TEXT_CONFIG.combat.lightning"

# ===================================================================
# WeaponSystem.ts
# ===================================================================
Write-Host "`n=== WeaponSystem.ts ===" -ForegroundColor Cyan
$f = "$base\weapon\WeaponSystem.ts"
Replace-InFile $f "import { WEAPON_DROP_DEFS, SCENE_ITEM_UNLOCKS, BALANCE_CONFIG } from '../../data';" "import { WEAPON_DROP_DEFS, SCENE_ITEM_UNLOCKS, BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"

Write-Host "`n=== All engine replacements done! ===" -ForegroundColor Green