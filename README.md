# Chientranhtiente

Simulator web cho mode chien thuat kinh te theo phong cach auto-battler.

## Tinh nang demo

- Economy: vang, lai suat, streak bonus, EXP va level.
- Shop roll theo ty le theo level.
- Mua/ban tuong, dua tuong len san, bench/board slot.
- Keo-tha Bench/Board de xep doi hinh nhanh.
- Tu dong gop 3 tuong trung de len sao.
- Trait synergy tinh theo doi hinh tren san.
- Combat basic theo tick voi HP bar, combat log, boss moi 5 round.
- Save/Load bang localStorage.

## Cau truc

- index.html
- styles.css
- src/app.js
- src/game.js
- src/ui.js
- src/storage.js
- data/units.json
- data/traits.json
- data/shopOdds.json

## Chay local

Day la static web app, mo truc tiep file index.html la chay.

Neu trinh duyet chan import JSON module khi mo file truc tiep, dung mot static server nhe:

```bash
npx serve .
```

Sau do mo URL local duoc in ra terminal.

## Deploy GitHub Pages

1. Vao repo Settings -> Pages.
2. Chon Source: Deploy from a branch.
3. Branch: main, Folder: /(root).
4. Save va doi build xong.
5. Truy cap site:
	https://ngoquanhao2009.github.io/Chientranhtiente/

## Cach choi nhanh

- Click tuong trong Shop de mua.
- Click tuong o Bench de ban.
- Keo-tha tuong giua Bench va Board de doi vi tri.
- Click tuong o Board de rut ve Bench.
- Bam Qua vong de danh combat va nhan income.