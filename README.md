# 노후대비 가이드

직장인을 위한 노후대비 가이드. 연금저축, IRP, 퇴직연금(DC), ISA로 세금 혜택을 받으며 노후 자금을 모으고, 굴리고, 꺼내 쓰는 방법을 정리했다.

- 사이트: `https://<계정>.github.io/<저장소>/` (게시 후 채울 것)
- 기준일: 2026-10-05 (세법·제도)

## 누구를 위한 글인가

입사 1~10년차 직장인. 연말정산 때 "연금저축 넣으면 좋다"는 말은 들었지만 아직 안 해본 사람. 노후는 수입 없는 20년 이상이고, 그 시간을 존엄하게 사는 게 이 준비의 목적이다.

## 두 가지 보기 방식

한 페이지에서 상단 토글로 바꾼다. 내용은 같고 보여주는 방식만 다르다.

| 모드 | 이런 사람에게 | 보여주는 방식 |
|---|---|---|
| **요점** | 처음 읽는 사람, 길게 집중하기 어려운 사람 | 절마다 요약 1줄 + 핵심 최대 3개만 본문에. 근거·숫자는 여백(넓은 화면)이나 하단 시트(모바일)에서 원할 때만 연다 |
| **정독** | 전부 읽고 싶은 사람, 인쇄해서 보려는 사람 | 전부 펼쳐서 한 흐름으로. 핵심은 짙게, 근거는 한 단계 작고 옅게. 인쇄하면 PDF |

PC·태블릿·모바일 반응형. 다크 모드 지원.

## 저장소 구조

```
├─ index.html          진입점
├─ content/guide.md    내용 원본 — 내용 수정은 이 파일에만
├─ assets/             화면 코드 (tokens.css, app.css, app.js, sim.js, vendor/)
├─ scripts/lint.py     출판 전 점검
├─ DESIGN.md           설계 정본 — 화면 원칙, 원본 문법, 결정 로그
└─ CLAUDE.md           작업 지침 (AI 작업 도구용, 사람이 읽어도 됨)
```

## 내용 고치기

1. `content/guide.md`를 고친다. 문법은 파일 첫머리 `::: 메모` 블록과 `DESIGN.md` 3~5장에 있다.
2. 점검: `python3 scripts/lint.py` (오류 0건이어야 한다)
3. 커밋하고 push하면 사이트에 반영된다.

GitHub 웹 화면에서 `content/guide.md`를 직접 고쳐도 된다.

## 로컬에서 미리 보기

`index.html`을 더블클릭하면 브라우저가 md 파일을 읽지 못한다. 폴더에서 아래를 실행하고 http://localhost:8000 을 연다.

```
python3 -m http.server 8000
```

## 게시 (GitHub Pages)

저장소 Settings → Pages → Build and deployment → Source: *Deploy from a branch*, Branch: `main` / `/ (root)`.

## 사용한 것

- 글꼴: [마루부리](https://hangeul.naver.com/font) (네이버, SIL Open Font License 1.1) — 네이버 웹폰트 CDN에서 불러온다
- md 파서: [markdown-it](https://github.com/markdown-it/markdown-it) 14.1.0 (MIT) — `assets/vendor/`에 포함

## 면책

이 문서는 개인 의견이며 투자권유가 아니다. 저자는 금융 전문가가 아니다. 세법과 제도는 바뀌므로 기준일을 확인하고, 실제 결정 전에 금융회사·국세청 자료로 확인할 것.
