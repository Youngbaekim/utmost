# 번역 지침 (My Utmost for His Highest, 1927 원문 → 한국어)

출력: tr/ko_MM.json — 입력 en_MM.json과 같은 순서·같은 id의 배열.
각 항목: {"id","title","verse","ref","paras":[...]}  (paras 개수·순서는 영문과 1:1 대응 필수)

1. 문체: 경건 묵상서 문체의 평서 경어체 '-합니다/-입니다'. 독자에게 하는 권면은 '-하십시오'. 
   Chambers 특유의 단호하고 압축적인 어조 유지, 의역은 최소화하되 한국어로 자연스럽게.
2. 성경 인용(verse 및 본문 속 따옴표 인용): 개역한글(1961) 문체를 기준으로 옮기되, 원문(KJV/RV/Moffatt) 의미와 어긋나면 원문 의미에 맞춘다. 
   개역개정 문구를 그대로 장문 복사하지 말고 직접 번역하되 익숙한 표현 유지.
3. ref(성경 장절): 한국어 약칭 없이 책 이름 풀어쓰기. 예) "Romans 8:28" → "로마서 8:28", "(R.V.)"→"(R.V.)" 유지, "(MOFFATT)"→"(모펫역)".
4. title: 짧은 명사형/구 제목. 대문자 영어 제목의 뜻을 살림.
5. 태그: 영문 paras에 있는 <b>…</b>, <i>…</i> 구조를 대응 위치에 그대로 유지(소제목 굵게, 인용 기울임).
6. 용어 통일: God=하나님, Jesus Christ=예수 그리스도, our Lord=우리 주님, the Holy Ghost/Spirit=성령, sanctification=성화, 
   Redemption=구속(救贖), Atonement=속죄, saint=성도, disciple=제자, surrender=굴복/내어드림(문맥), abandon(ment)=전적인 맡김/내던짐, 
   intercession=중보기도, the natural=자연적인 것, conviction of sin=죄의 깨달음(죄를 깨닫게 하심), personality=인격, disposition=성향.
7. JSON 유효성: 큰따옴표는 한국어 본문에서 “ ” (전각 곡선따옴표) 사용, 작은따옴표 ‘ ’. 직접 \" 이스케이프 지양.
8. 누락·요약 금지. 모든 문장 번역.
