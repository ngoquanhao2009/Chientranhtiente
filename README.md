# Chientranhtiente

Simulator web cho mode chien thuat kinh te theo phong cach auto-battler.

## Tinh nang demo

- Economy: vang, lai suat, streak bonus, EXP va level.
- Shop roll theo ty le theo level.
- Mua/ban tuong, dua tuong len san, bench/board slot.
- Keo-tha Bench/Board de xep doi hinh nhanh.
- Tu dong gop 3 tuong trung de len sao.
- Synergy 2 lop: Phe phai + Toc he, moi lop co moc kich rieng.
- Combat basic theo tick voi HP bar, combat log, boss moi 5 round.
- Save/Load bang localStorage.
- Tu dong autosave sau moi thao tac hop le (van giu nut Luu/Tai thu cong).
- Passive skill theo tung tuong (wiki-inferred), co tac dong truc tiep vao combat.
- Mau skill theo tac dong: xanh la co loi, do la gay bat loi, vang la hon hop.
- Them trigger ky nang: khi tung don danh (on-attack) va khi bi dinh don (on-hit).
- Combat log co emoji hieu ung de nhan biet buff/debuff/skill/attack nhanh hon.
- Card tuong co icon trigger rieng cho ATK/HIT/AURA.
- Combat co hieu ung hit theo loai (crit, reflect, shielded) va counter text noi khi proc.
- Co setting bat/tat Emoji FX phu hop tung nguoi choi.
- Integrity check JSON khi khoi dong: canh bao som neu thieu id/cost/stats.
- Lock shop hien ro dang giu toi round nao de de canh economy.

## Cau truc

- index.html
- styles.css
- src/app.js
- src/game.js
- src/ui.js
- src/storage.js
- data/characters.json
- data/factions.json
- data/archetypes.json
- data/bosses.json
- data/shopOdds.json
- data/passives.json
- docs/BALANCE_GUIDE.md

## Tai lieu can bang

- Xem huong dan chinh meta tai `docs/BALANCE_GUIDE.md`.
- Nhat ky train an toan: `docs/TRAIN_LOG.md`.

## Luu checkpoint de tranh mat tien do

Neu ban vua train xong 1 doan quan trong, luu checkpoint nhanh:

```bash
git add -A
git commit -m "checkpoint: mo ta ngan"
git push
```

Neu mang/GitHub loi tam thoi, tao patch du phong local:

```bash
git diff > checkpoint.patch
```

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