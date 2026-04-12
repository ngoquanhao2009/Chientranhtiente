# TRAIN_LOG

Muc tieu: luu nhanh tien do train/develop de khong mat cong viec khi loi sync GitHub.

## Cach dung nhanh

1. Moi lan truoc khi sua lon, tao 1 muc moi theo mau ben duoi.
2. Sau moi buoi train, cap nhat 3 dong: Da lam, Dang do, Buoc tiep theo.
3. Truoc khi tat may, chay luu nhanh:

```bash
git add -A
git commit -m "checkpoint: <noi-dung-ngan>"
git push
```

4. Neu push loi tam thoi, van giu checkpoint local va copy patch de phong:

```bash
git diff > checkpoint.patch
```

## Mau ghi log

### [YYYY-MM-DD HH:mm] Ten phien train

- Muc tieu:
- Da lam:
- File da sua:
- Dang do:
- Buoc tiep theo:
- Lenh checkpoint da chay:

## Nhat ky

### [2026-04-12 00:00] Khoi tao he thong log an toan

- Muc tieu: Tranh mat tien do train khi gap loi luu/sync.
- Da lam: Tao file log + huong dan checkpoint git.
- File da sua: docs/TRAIN_LOG.md, README.md.
- Dang do: Chua ghi them phien train moi.
- Buoc tiep theo: Moi phien moi them 1 block log theo mau.
- Lenh checkpoint da chay: Chua chay.
