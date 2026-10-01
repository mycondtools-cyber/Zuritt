#!/bin/bash
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
mkdir -p pv
for S in A B C; do
  case $S in A) L=28;; B) L=26;; C) L=22;; esac
  for spec in "1350 4x5" "1920 9x16"; do set -- $spec
    for s in 0 1 2 3; do node rvp.js $1 $s 4 pv/${S}_$2_$s.mp4 $S $L & done; wait
    printf "file '${S}_$2_0.mp4'\nfile '${S}_$2_1.mp4'\nfile '${S}_$2_2.mp4'\nfile '${S}_$2_3.mp4'\n" > pv/l_${S}_$2.txt
    $FF -y -loglevel error -f concat -safe 0 -i pv/l_${S}_$2.txt -i music_$S.wav -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -shortest -movflags +faststart pv/Mycond_seminar_${S}_$2.mp4
    echo "done $S $2"
  done
done
