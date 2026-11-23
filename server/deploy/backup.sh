#!/bin/sh
# Ehtiyat nüsxə: PostgreSQL dump (pg_dump -Fc) + şəkil qovluğu (tar.gz).
#   backup.sh once   — bir dəfə
#   backup.sh loop   — hər gün BACKUP_HOUR-da (docker-compose "backup" xidməti)
# Köhnə nüsxələr BACKUP_KEEP_DAYS gündən sonra silinir.
# VACİB: nüsxələri başqa yerə də köçürün (başqa disk/server, rclone ilə bulud) — disk sıradan çıxsa itməsin.
set -eu
umask 077  # nüsxələrdə şifrə hash-ləri var — yalnız sahib oxuya bilsin
DIR=/backups
KEEP=${BACKUP_KEEP_DAYS:-14}
HOUR=${BACKUP_HOUR:-3}

run() {
  ts=$(date +%Y%m%d-%H%M)
  echo "[backup] $ts başladı"
  pg_dump -Fc -f "$DIR/db-$ts.dump.part"
  mv "$DIR/db-$ts.dump.part" "$DIR/db-$ts.dump"
  if [ -d /data/photos ]; then
    tar -czf "$DIR/photos-$ts.tar.gz.part" -C /data photos
    mv "$DIR/photos-$ts.tar.gz.part" "$DIR/photos-$ts.tar.gz"
  fi
  find "$DIR" -maxdepth 1 \( -name 'db-*.dump' -o -name 'photos-*.tar.gz' \) -mtime +"$KEEP" -delete
  rm -f "$DIR"/*.part
  echo "[backup] hazırdır: $(ls -1 "$DIR" | tail -n 2 | tr '\n' ' ')"
}

case "${1:-once}" in
  once) run ;;
  loop)
    last=""
    echo "[backup] gündəlik nüsxə saat $HOUR:00-da, $KEEP gün saxlanılır"
    while true; do
      today=$(date +%Y-%m-%d)
      if [ "$(date +%H | sed 's/^0//')" = "$HOUR" ] && [ "$last" != "$today" ]; then
        run || echo "[backup] XƏTA — növbəti cəhd bir saatdan sonra"
        last=$today
      fi
      sleep 300
    done ;;
  *) echo "istifadə: backup.sh once|loop"; exit 1 ;;
esac
