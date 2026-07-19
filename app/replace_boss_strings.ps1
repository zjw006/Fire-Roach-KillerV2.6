$file = 'd:\CocosGreater\Fire Roach KillerV2.6\app\src\game\engine\boss\BossBattleSystem.ts'
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# 1. Update import
$content = $content.Replace(
  "import { BALANCE_CONFIG } from '../../data';",
  "import { BALANCE_CONFIG, TEXT_CONFIG } from '../../data';"
)

# 2. Replace onAddFloatingText string arguments
$content = $content.Replace("'螂老大出现了!'", "TEXT_CONFIG.combat.bossAppear")
$content = $content.Replace("'它正在产卵!消灭虫卵!'", "TEXT_CONFIG.combat.bossSpawnEggs")
$content = $content.Replace("'螂