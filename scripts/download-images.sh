#!/bin/bash
# Download real images from Unsplash for Omena art auction site
# Using Unsplash Source URLs (direct image links, free to use)

set -e

BASE="public/images"
mkdir -p "$BASE/auctions" "$BASE/team" "$BASE/events" "$BASE/press" "$BASE/hero"

# Remove old SVGs
rm -f "$BASE/auctions/"*.svg "$BASE/team/"*.svg "$BASE/events/"*.svg "$BASE/press/"*.svg

echo "=== Downloading lot images (paintings) ==="
# Lots 1-12: Polish/European paintings
declare -a PAINTING_IDS=(
  "photo-1579783902614-a3fb3927b6a5"   # colorful abstract
  "photo-1541961017774-22349e4a1262"   # modern art gallery
  "photo-1549490349-8643362247b2"      # abstract painting
  "photo-1547891654-e66ed7ebb968"      # oil painting landscape
  "photo-1578301978693-85fa9c0320b9"   # gallery wall art
  "photo-1574182245530-967d9b3831af"   # classical painting
  "photo-1518998053901-5348d3961a04"   # art brushstrokes
  "photo-1482160549825-59d1b23cb208"   # portrait painting
  "photo-1577083552431-6e5fd01988ec"   # abstract colorful
  "photo-1571115764595-644a1f56a55c"   # impressionist style
  "photo-1544967082-d9d25d867d66"      # dark moody painting
  "photo-1578662996442-48f60103fc96"   # watercolor art
)

for i in "${!PAINTING_IDS[@]}"; do
  n=$((i + 1))
  echo "  lot-$n.jpg (painting ${PAINTING_IDS[$i]})"
  curl -sL "https://images.unsplash.com/${PAINTING_IDS[$i]}?w=800&h=800&fit=crop&q=80" -o "$BASE/auctions/lot-$n.jpg"
done

echo "=== Downloading lot images (sculptures) ==="
# Lots 13-20: Sculptures
declare -a SCULPTURE_IDS=(
  "photo-1561839561-b13bcfe95249"   # classical sculpture
  "photo-1558618666-fcd25c85f82e"   # modern sculpture
  "photo-1544413660-299165566b1d"   # marble sculpture
  "photo-1582555172866-f73bb12a2ab3"   # bronze figure
  "photo-1618005198919-d3d4b5a92ead"   # abstract sculpture
  "photo-1596552183299-000ef0b3dd93"   # stone sculpture
  "photo-1605721911519-3dfeb3be25e7"   # geometric sculpture
  "photo-1570432086748-54d532410889"   # figurative sculpture
)

for i in "${!SCULPTURE_IDS[@]}"; do
  n=$((i + 13))
  echo "  lot-$n.jpg (sculpture ${SCULPTURE_IDS[$i]})"
  curl -sL "https://images.unsplash.com/${SCULPTURE_IDS[$i]}?w=800&h=800&fit=crop&q=80" -o "$BASE/auctions/lot-$n.jpg"
done

echo "=== Downloading lot images (photography) ==="
# Lots 21-30: Art photography
declare -a PHOTO_IDS=(
  "photo-1506905925346-21bda4d32df4"   # dramatic landscape
  "photo-1470071459604-3b5ec3a7fe05"   # nature art
  "photo-1500382017468-9049fed747ef"   # artistic sunrise
  "photo-1494972308805-463bc619d34e"   # street photography
  "photo-1553949345-eb786bb3f7ba"      # abstract photo art
  "photo-1516410529446-2c777cb7366d"   # urban architecture
  "photo-1501594907352-04cda38ebc29"   # b&w photography
  "photo-1452587925148-ce544e77e70d"   # artistic portrait
  "photo-1511884642898-4c92249e20b6"   # nature detail
  "photo-1504198453319-5ce911bafcde"   # light art photography
)

for i in "${!PHOTO_IDS[@]}"; do
  n=$((i + 21))
  echo "  lot-$n.jpg (photography ${PHOTO_IDS[$i]})"
  curl -sL "https://images.unsplash.com/${PHOTO_IDS[$i]}?w=800&h=800&fit=crop&q=80" -o "$BASE/auctions/lot-$n.jpg"
done

echo "=== Downloading lot images (mixed) ==="
# Lots 31-38: Mixed media
declare -a MIXED_IDS=(
  "photo-1515405295579-ba7b45403062"   # mixed media art
  "photo-1513364776144-60967b0f800f"   # contemporary art
  "photo-1460661419201-fd4cecdf8a8b"   # art installation
  "photo-1561214078-f3247647fc5e"      # gallery installation
  "photo-1578321272176-b7bbc0679853"   # abstract mixed
  "photo-1536924940564-58f75d93a96b"   # collage art
  "photo-1499781350541-7783f6c6a0c8"   # modern gallery
  "photo-1513519245088-0e12902e35ca"   # textile art
)

for i in "${!MIXED_IDS[@]}"; do
  n=$((i + 31))
  echo "  lot-$n.jpg (mixed ${MIXED_IDS[$i]})"
  curl -sL "https://images.unsplash.com/${MIXED_IDS[$i]}?w=800&h=800&fit=crop&q=80" -o "$BASE/auctions/lot-$n.jpg"
done

echo "=== Downloading team portraits ==="
declare -a TEAM_IDS=(
  "photo-1573496359142-b8d87734a5a2"   # professional woman
  "photo-1472099645785-5658abf4ff4e"   # professional man
  "photo-1580489944761-15a19d654956"   # curator woman
  "photo-1507003211169-0a1dd7228f2d"   # business man
  "photo-1438761681033-6461ffad8d80"   # young woman professional
)
declare -a TEAM_NAMES=(
  "katarzyna-nowak"
  "andrzej-kowalski"
  "joanna-kaminska"
  "marek-zielinski"
  "aleksandra-wisniewska"
)

for i in "${!TEAM_IDS[@]}"; do
  echo "  ${TEAM_NAMES[$i]}.jpg"
  curl -sL "https://images.unsplash.com/${TEAM_IDS[$i]}?w=600&h=600&fit=crop&crop=face&q=80" -o "$BASE/team/${TEAM_NAMES[$i]}.jpg"
done

echo "=== Downloading event images ==="
declare -a EVENT_IDS=(
  "photo-1540575467063-178a50c2df87"   # auction/gala event
  "photo-1513364776144-60967b0f800f"   # art exhibition
  "photo-1492684223066-81342ee5ff30"   # gala evening
  "photo-1531058020387-3be344556be6"   # gallery opening
  "photo-1505236858219-8359eb29e329"   # elegant event
  "photo-1511795409834-ef04bbd61622"   # art gallery
)
declare -a EVENT_NAMES=(
  "fotografia-aukcja"
  "wystawa-malarstwo"
  "gala-charytatywna"
  "wystawa-swiatlo"
  "rzezba-aukcja"
  "gala-kolekcjonerow"
)

for i in "${!EVENT_IDS[@]}"; do
  echo "  ${EVENT_NAMES[$i]}.jpg"
  curl -sL "https://images.unsplash.com/${EVENT_IDS[$i]}?w=800&h=500&fit=crop&q=80" -o "$BASE/events/${EVENT_NAMES[$i]}.jpg"
done

echo "=== Downloading press images ==="
declare -a PRESS_IDS=(
  "photo-1504711434969-e33886168d5c"   # newspaper
  "photo-1495020689067-958852a7765e"   # art market
  "photo-1552664730-d307ca884978"      # business meeting
  "photo-1586339949916-3e9457bef6d3"   # magazine
  "photo-1557804506-669a67965ba0"      # art event
  "photo-1524178232363-1fb2b075b655"   # conference
  "photo-1497366216548-37526070297c"   # workspace
  "photo-1493612276216-ee3925520721"   # creative
)
declare -a PRESS_NAMES=(
  "beksinski-rekord"
  "biennale-wenecja"
  "fotografia-rynek"
  "mlode-talenty"
  "ranking-forbes"
  "raport-rynek"
  "rzezba-sezon"
  "wywiad-nowak"
)

for i in "${!PRESS_IDS[@]}"; do
  echo "  ${PRESS_NAMES[$i]}.jpg"
  curl -sL "https://images.unsplash.com/${PRESS_IDS[$i]}?w=800&h=500&fit=crop&q=80" -o "$BASE/press/${PRESS_NAMES[$i]}.jpg"
done

echo "=== Downloading hero image ==="
curl -sL "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&h=1080&fit=crop&q=80" -o "$BASE/hero/hero-bg.jpg"

echo ""
echo "=== Done! ==="
echo "Auctions: $(ls $BASE/auctions/*.jpg 2>/dev/null | wc -l) images"
echo "Team: $(ls $BASE/team/*.jpg 2>/dev/null | wc -l) images"
echo "Events: $(ls $BASE/events/*.jpg 2>/dev/null | wc -l) images"
echo "Press: $(ls $BASE/press/*.jpg 2>/dev/null | wc -l) images"
echo "Hero: $(ls $BASE/hero/*.jpg 2>/dev/null | wc -l) images"
