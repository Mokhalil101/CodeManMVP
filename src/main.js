new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: COLS*T, height: HUD+ROWS*T, backgroundColor: '#0b0b2a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, SettingsScene, GameScene, LevelCompleteScene, GameOverScene]
});
document.querySelectorAll('#dpad button').forEach(b=>{
  b.addEventListener('pointerdown', e=>{ e.preventDefault(); const [x,y]=b.dataset.d.split(',').map(Number); Input.x=x; Input.y=y; });
});
