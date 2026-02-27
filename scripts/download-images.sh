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
  "photo-1543857778-c4a1a3e0b2eb"      # abstract modern painting
  "photo-1547891654-e66ed7ebb968"      # oil painting landscape
  "photo-1578301978693-85fa9c0320b9"   # gallery wall art
  "photo-1574182245530-967d9b3831af"   # classical painting
  "photo-1518998053901-5348d3961a04"   # art brushstrokes
  "photo-1482160549825-59d1b23cb208"   # portrait painting
  "photo-1460661419201-fd4cecdf8a8b"   # impressionist art installation
  "photo-1579541814924-49fef17c5be5"   # dramatic figurative art
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
  "photo-1588515724527-074a7a56616c"   # classical bust sculpture
  "photo-1576020799627-aeac74d58064"   # museum bronze sculpture
  "photo-1558021212-51b6ecfa0db9"   # elongated abstract sculpture
  "photo-1582555172866-f73bb12a2ab3"   # bronze figure
  "photo-1618005198919-d3d4b5a92ead"   # abstract sculpture
  "photo-1594736797933-d0501ba2fe65"   # sculpture gallery torso
  "photo-1551913902-c92207136625"   # white marble sculpture
  "photo-1582738411706-bfc8e691d1c2"   # art museum geometric sculpture
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
  "photo-1414235077428-338989a2e8c0"   # misty cityscape old town
  "photo-1553949345-eb786bb3f7ba"      # abstract photo art
  "photo-1516410529446-2c777cb7366d"   # urban architecture
  "photo-1501594907352-04cda38ebc29"   # b&w photography
  "photo-1452587925148-ce544e77e70d"   # artistic portrait
  "photo-1511884642898-4c92249e20b6"   # nature detail
  "photo-1526374965328-7f61d4dc18c5"   # abstract light photography
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
  "photo-1545987796-200677ee1011"      # minimalist art painting
  "photo-1578321272176-b7bbc0679853"   # abstract mixed
  "photo-1554907984-15263bfd63bd"   # conceptual art photography
  "photo-1563396983906-b3795482a59a"   # kinetic sculpture installation
  "photo-1544531586-fde5298cdd40"   # digital graphic art print
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
  "photo-1519167758481-83f550bb49b3"   # elegant charity gala
  "photo-1531058020387-3be344556be6"   # gallery opening
  "photo-1564399579883-451a5d44ec08"   # sculpture exhibition gallery
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
  "photo-1511795409834-ef04bbd61622"   # art auction gallery
  "photo-1495020689067-958852a7765e"   # art market
  "photo-1518709766631-a6a7f45921c3"   # art photography gallery
  "photo-1586339949916-3e9457bef6d3"   # magazine
  "photo-1531243269054-5ebf6f34081e"   # luxury auction house
  "photo-1524178232363-1fb2b075b655"   # conference
  "photo-1578926375605-eaf7559b1458"   # sculpture exhibition season
  "photo-1556761175-5973dc0f32e7"   # professional woman curator
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
