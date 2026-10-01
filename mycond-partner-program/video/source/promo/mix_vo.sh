#!/bin/bash
# ./mix_vo.sh video.mp4 voice.mp3 out.mp4   — voice starts at 0.6 s, music ducked under it
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
$FF -y -loglevel error -i "$1" -i "$2" -filter_complex \
 "[1:a]aresample=48000,adelay=600|600,highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,volume=1.6[vo];[vo]asplit=2[vo1][vo2];[0:a][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[m];[m][vo2]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95" \
 -c:v copy -c:a aac -b:a 320k "$3"
