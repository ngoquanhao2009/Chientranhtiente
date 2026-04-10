# Balance Guide

Tai lieu nay giup can bang game theo tung giai doan tran va cost-tier.

## Muc tieu can bang

- Dau game (round 1-6): de len bai, khong bi snowball qua nhanh.
- Mid game (round 7-14): chuyen doi doi hinh, 2-3 cost co dat dung.
- Late game (round 15+): 4-5 cost va sao cao la loi the, nhung khong one-shot qua de.

## Cac van can chinh

- Base stats: `data/characters.json`
- Ti le shop: `data/shopOdds.json`
- Passive per unit: `data/passives.json`
- Scaling combat theo round/cost: `src/game.js`

## Quy tac nhanh cho stats

- Cost 1: hp/atk trung binh, manh o dau game, yeu dan ve late.
- Cost 2: la cot song mid game, stat tang ~12-18% so voi cost 1.
- Cost 3: diem chuyen tiep, co 1 vai carry/chong chiu ro vai tro.
- Cost 4: core late-mid, stat tang ro va passive on dinh.
- Cost 5: tranh qua vo doi, uu tien suc manh theo dieu kien thay vi flat stat.

## Quy tac nhanh cho passive

- Buff team (`teamAtkPct`, `teamSpdPct`) nen nho hon buff self de tranh stack vo han.
- Debuff enemy (`enemyAtkPctDown`, `enemySpdPctDown`) nen nhe hon buff tuong duong.
- Proc (`extraHitChance`) nen giu trong khoang 0.18-0.35 truoc scaling.
- Execute (`executeBonusPct`) nen duoi 0.28 truoc scaling.
- Heal chu ky (`periodicHealPct`) nen duoi 0.1 truoc scaling.

## Scaling da co san trong code

Tai `src/game.js`, passive duoc scale boi:

- Cost-tier factor: cost cao duoc scale tot hon.
- Star factor: sao cao tang suc manh vua phai.
- Round smoothing: round 11+ va 16+ giam proc/buff de combat muot hon.

Neu can tang/do giam meta nhanh, chinh cac ham:

- `passivePowerScale(cost, star, round)`
- `scalePassivePct(value, scale, cap)`
- `scalePassiveChance(value, cost, round, cap)`

## Quy trinh can bang de xuat

1. Chay 10-15 tran tu dong (hoac test tay) theo cac moc round 5, 10, 15, 20.
2. Ghi lai top unit qua ap dao (>70% tran co trong doi hinh thang).
3. Nerf nhe theo thu tu: proc chance -> execute bonus -> base atk.
4. Buff unit yeu theo thu tu: utility passive -> base hp/spd -> base atk.
5. Moi lan chi chinh 1 nhom nho, roi test lai.

## Red flags can tranh

- Nhieu passive buff team lon cung luc (snowball).
- Carry cost 1 van one-shot duoc o round 15+.
- Tank cost 5 ket hop heal team khong the bi ha.
- Boss round mat can bang khi bi stack debuff qua manh.

## Checklist truoc release

- Khong co warning integrity JSON khi khoi dong.
- Mid game co nhieu lua chon doi hinh, khong chi 1 bai duy nhat.
- Late game can sao/vi tri, khong chi dua vao may man proc.
- Combat log de doc, nhan biet ro BUFF/DEBUFF/MIXED.
