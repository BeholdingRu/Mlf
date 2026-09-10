import { useId, type CSSProperties } from 'react'
import { getSequentialItemProgress } from '../lib/bible-growth'

type VineSpec = {
  path: string
  branches?: string[]
  tendrils?: string[]
  leaves: string[]
}

type GrapeSprig = {
  x: number
  y: number
  rotation: number
  scale: number
}

const VINES: VineSpec[] = [
  {
    path: 'M500 500C430 500 478 411 414 382S314 358 332 300S246 250 286 188S235 139 166 116C122 98 78 102 54 126C36 144 40 173 62 188',
    branches: [
      'M414 382C361 424 322 365 275 406S198 381 145 326',
      'M332 300C386 270 369 218 322 223S270 190 230 142',
    ],
    tendrils: [
      'M270 238C231 221 224 187 246 176C269 165 279 198 257 207',
      'M412 378C374 368 361 337 379 323C399 308 416 336 397 350',
    ],
    leaves: [
      'translate(500 500) rotate(8) scale(.44)',
      'translate(414 382) rotate(205) scale(.55)',
      'translate(332 300) rotate(142) scale(.58)',
      'translate(286 188) rotate(220) scale(.52)',
      'translate(166 116) rotate(172) scale(.5)',
      'translate(275 406) rotate(172) scale(.48)',
      'translate(145 326) rotate(205) scale(.5)',
      'translate(322 223) rotate(146) scale(.48)',
      'translate(230 142) rotate(198) scale(.5)',
    ],
  },
  {
    path: 'M500 500C435 470 432 431 474 367S395 309 435 250S362 166 303 118C275 94 237 95 210 113C190 128 185 154 197 175',
    branches: ['M474 367C520 330 564 384 611 341S663 309 709 263'],
    tendrils: ['M451 341C474 316 469 283 448 279C425 274 425 306 447 309'],
    leaves: [
      'translate(474 367) rotate(248) scale(.5)',
      'translate(435 250) rotate(185) scale(.56)',
      'translate(303 118) rotate(215) scale(.54)',
      'translate(611 341) rotate(18) scale(.48)',
      'translate(709 263) rotate(328) scale(.52)',
    ],
  },
  {
    path: 'M500 500C450 445 548 407 488 347S547 269 496 211S551 166 505 122C480 104 454 116 447 143',
    branches: ['M488 347C437 315 410 359 365 326S316 284 267 274'],
    leaves: [
      'translate(488 347) rotate(304) scale(.48)',
      'translate(496 211) rotate(238) scale(.55)',
      'translate(505 122) rotate(275) scale(.48)',
      'translate(365 326) rotate(208) scale(.48)',
      'translate(267 274) rotate(164) scale(.5)',
    ],
  },
  {
    path: 'M500 500C475 430 570 423 534 354S612 299 575 244S648 166 702 118C731 96 769 96 796 115C817 130 823 156 811 177',
    branches: ['M534 354C583 318 614 361 657 327S710 291 758 260'],
    tendrils: ['M588 367C620 354 634 323 615 310C594 296 579 326 602 337'],
    leaves: [
      'translate(534 354) rotate(332) scale(.5)',
      'translate(575 244) rotate(290) scale(.56)',
      'translate(702 118) rotate(318) scale(.54)',
      'translate(657 327) rotate(32) scale(.48)',
      'translate(758 260) rotate(315) scale(.5)',
    ],
  },
  {
    path: 'M500 500C500 430 531 409 603 390S670 316 731 331S802 257 837 198S901 178 930 146C956 131 968 145 966 166C964 187 946 202 925 198',
    branches: ['M603 390C650 434 687 379 735 417S798 390 843 350'],
    tendrils: ['M817 327C846 316 859 286 842 273C821 259 805 286 826 300'],
    leaves: [
      'translate(603 390) rotate(24) scale(.52)',
      'translate(731 331) rotate(306) scale(.56)',
      'translate(837 198) rotate(20) scale(.52)',
      'translate(930 146) rotate(332) scale(.46)',
      'translate(735 417) rotate(44) scale(.48)',
      'translate(843 350) rotate(326) scale(.5)',
    ],
  },
  {
    path: 'M500 500C525 435 604 536 674 477S766 501 813 440S897 440 950 348C972 329 976 302 962 284C948 267 926 267 912 284',
    branches: ['M674 477C718 526 760 475 806 517S878 493 928 526'],
    tendrils: ['M690 480C717 503 747 497 750 476C752 453 720 454 719 476'],
    leaves: [
      'translate(674 477) rotate(35) scale(.5)',
      'translate(813 440) rotate(302) scale(.56)',
      'translate(950 348) rotate(338) scale(.48)',
      'translate(806 517) rotate(55) scale(.5)',
      'translate(928 526) rotate(18) scale(.48)',
    ],
  },
  {
    path: 'M500 500C550 450 350 360 490 292S660 185 790 122C832 87 882 87 913 115C946 146 936 191 903 210C875 226 844 210 840 184C837 161 855 144 875 149',
    leaves: [
      'translate(490 292) rotate(198) scale(.48)',
      'translate(790 122) rotate(322) scale(.55)',
    ],
  },
  {
    path: 'M500 500C565 480 628 466 698 531S785 520 842 579S901 590 950 661C972 681 976 709 961 728C946 746 920 747 904 730',
    branches: ['M698 531C646 575 692 622 747 598S818 626 868 682'],
    tendrils: ['M676 572C701 548 733 553 736 575C740 600 708 603 704 580'],
    leaves: [
      'translate(698 531) rotate(48) scale(.5)',
      'translate(842 579) rotate(10) scale(.56)',
      'translate(950 661) rotate(42) scale(.48)',
      'translate(747 598) rotate(68) scale(.5)',
      'translate(868 682) rotate(38) scale(.52)',
    ],
  },
  {
    path: 'M500 500C570 500 501 603 576 646S610 739 684 751S725 836 811 900C837 930 875 948 906 933C930 921 940 895 929 875',
    branches: ['M576 646C522 690 564 745 620 724S681 760 718 811'],
    tendrils: ['M596 651C623 666 627 697 608 708C587 721 573 692 594 680'],
    leaves: [
      'translate(576 646) rotate(58) scale(.52)',
      'translate(684 751) rotate(24) scale(.57)',
      'translate(811 900) rotate(55) scale(.5)',
      'translate(620 724) rotate(82) scale(.48)',
      'translate(718 811) rotate(28) scale(.5)',
    ],
  },
  {
    path: 'M500 500C565 530 454 599 520 665S453 759 510 823S465 897 514 930C488 951 458 944 448 920',
    leaves: [
      'translate(520 665) rotate(118) scale(.5)',
      'translate(510 823) rotate(62) scale(.56)',
      'translate(514 930) rotate(98) scale(.47)',
    ],
  },
  {
    path: 'M500 500C550 555 492 612 419 646S381 728 319 749S281 836 191 900C164 930 126 948 94 933C70 921 60 895 71 875',
    branches: ['M419 646C471 688 432 744 377 726S316 765 280 816'],
    tendrils: ['M402 641C376 659 374 691 395 700C418 710 428 679 405 670'],
    leaves: [
      'translate(419 646) rotate(142) scale(.52)',
      'translate(319 749) rotate(192) scale(.57)',
      'translate(191 900) rotate(148) scale(.5)',
      'translate(377 726) rotate(188) scale(.48)',
      'translate(280 816) rotate(142) scale(.5)',
    ],
  },
  {
    path: 'M500 500C525 570 381 470 307 529S218 511 158 568S99 580 50 648C28 628 24 600 39 581C54 563 80 562 96 579',
    branches: ['M307 529C264 484 222 535 177 498S111 492 65 456'],
    tendrils: ['M326 573C300 551 269 559 268 581C268 605 299 605 301 583'],
    leaves: [
      'translate(307 529) rotate(158) scale(.5)',
      'translate(158 568) rotate(202) scale(.56)',
      'translate(50 648) rotate(160) scale(.46)',
      'translate(177 498) rotate(202) scale(.48)',
      'translate(65 456) rotate(166) scale(.5)',
    ],
  },
  {
    path: 'M500 500C500 570 650 360 510 292S340 185 210 122C168 92 118 95 86 128C58 157 68 199 98 218C123 234 154 223 164 198C173 175 159 153 139 151',
    leaves: [
      'translate(510 292) rotate(18) scale(.48)',
      'translate(210 122) rotate(205) scale(.54)',
    ],
  },
  {
    path: 'M500 500C475 565 392 533 325 475S236 492 184 433S101 431 50 339C28 320 24 293 38 275C52 258 74 258 88 275',
    branches: ['M325 475C279 526 237 478 193 521S126 545 77 597'],
    tendrils: ['M324 478C297 499 267 492 264 470C261 446 293 445 296 468'],
    leaves: [
      'translate(325 475) rotate(218) scale(.5)',
      'translate(184 433) rotate(172) scale(.56)',
      'translate(50 339) rotate(198) scale(.47)',
      'translate(193 521) rotate(155) scale(.48)',
      'translate(77 597) rotate(212) scale(.5)',
    ],
  },
  {
    path: 'M500 500C450 550 643 632 508 703S353 813 275 920C235 954 182 958 151 930C121 901 133 861 167 848C201 835 230 859 224 887C219 911 193 925 175 911',
    leaves: [
      'translate(508 703) rotate(135) scale(.5)',
      'translate(275 920) rotate(168) scale(.52)',
    ],
  },
  {
    path: 'M500 500C435 525 357 632 492 703S647 813 725 920C765 954 818 958 849 930C879 901 867 861 833 848C799 835 770 859 776 887C781 911 807 925 825 911',
    leaves: [
      'translate(492 703) rotate(45) scale(.5)',
      'translate(725 920) rotate(12) scale(.52)',
    ],
  },
]

const VINE_DRAW_ORDER = [8, 2, 13, 5, 0, 10, 3, 15, 7, 1, 12, 4, 9, 6, 14, 11]
const VINE_SEQUENCE_POSITIONS = VINES.map((_, vineIndex) => VINE_DRAW_ORDER.indexOf(vineIndex))

const GRAPE_SPRIGS: GrapeSprig[] = [
  { x: 500, y: 500, rotation: -12, scale: 0.72 },
  { x: 414, y: 382, rotation: 18, scale: 0.65 },
  { x: 332, y: 300, rotation: 24, scale: 0.72 },
  { x: 435, y: 250, rotation: -18, scale: 0.68 },
  { x: 488, y: 347, rotation: 12, scale: 0.64 },
  { x: 575, y: 244, rotation: 20, scale: 0.7 },
  { x: 603, y: 390, rotation: -16, scale: 0.65 },
  { x: 731, y: 331, rotation: -24, scale: 0.67 },
  { x: 674, y: 477, rotation: 16, scale: 0.64 },
  { x: 698, y: 531, rotation: 18, scale: 0.7 },
  { x: 576, y: 646, rotation: -18, scale: 0.65 },
  { x: 620, y: 724, rotation: -22, scale: 0.68 },
  { x: 520, y: 665, rotation: 16, scale: 0.64 },
  { x: 419, y: 646, rotation: -16, scale: 0.65 },
  { x: 377, y: 726, rotation: 24, scale: 0.68 },
  { x: 325, y: 475, rotation: 18, scale: 0.64 },
  { x: 307, y: 529, rotation: -18, scale: 0.7 },
  { x: 286, y: 188, rotation: -22, scale: 0.58 },
  { x: 267, y: 274, rotation: 20, scale: 0.6 },
  { x: 496, y: 211, rotation: -10, scale: 0.59 },
  { x: 702, y: 118, rotation: 18, scale: 0.58 },
  { x: 837, y: 198, rotation: -22, scale: 0.6 },
  { x: 813, y: 440, rotation: 15, scale: 0.61 },
  { x: 842, y: 579, rotation: -15, scale: 0.62 },
  { x: 868, y: 682, rotation: 22, scale: 0.58 },
  { x: 684, y: 751, rotation: -16, scale: 0.61 },
  { x: 718, y: 811, rotation: 18, scale: 0.57 },
  { x: 510, y: 823, rotation: -12, scale: 0.6 },
  { x: 319, y: 749, rotation: 20, scale: 0.62 },
  { x: 280, y: 816, rotation: -18, scale: 0.57 },
  { x: 158, y: 568, rotation: 16, scale: 0.59 },
  { x: 184, y: 433, rotation: -20, scale: 0.58 },
].sort((left, right) => distanceFromCenter(left) - distanceFromCenter(right))

function distanceFromCenter(item: GrapeSprig) {
  return Math.hypot(item.x - 500, item.y - 500)
}

function rangeProgress(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0
  return Math.max(0, Math.min(1, (progress - start) / (end - start)))
}

function drawingStyle(progress: number): CSSProperties {
  return { strokeDashoffset: 1 - progress }
}

function leafStyle(vineProgress: number, index: number, leafCount: number): CSSProperties {
  const start = 0.22 + index / Math.max(1, leafCount) * 0.62
  return { opacity: rangeProgress(vineProgress, start, Math.min(1, start + 0.16)) }
}

export function BibleGrowthVine({ progress, grapeProgress }: { progress: number; grapeProgress: number }) {
  const grapeClipPrefix = `bible-grape-item-${useId().replaceAll(':', '')}`
  if (progress <= 0) return <div className="bible-library-vine-anchor" aria-hidden="true" />

  const vineProgresses = VINES.map((_, index) => getSequentialItemProgress(progress, VINE_SEQUENCE_POSITIONS[index], VINES.length))
  const grapeProgresses = GRAPE_SPRIGS.map((_, index) => getSequentialItemProgress(grapeProgress, index, GRAPE_SPRIGS.length))

  return (
    <div className="bible-library-vine-anchor" aria-hidden="true">
      <svg className="bible-library-growth-vine" viewBox="0 0 1000 1000">
        <defs>
          <g id="bible-vine-leaf-sprig">
            <path className="bible-vine-leaf-stem" d="M0 0C7-5 12-12 16-20" />
            <path className="bible-vine-leaf-shape" d="M16-20C24-39 41-40 50-27C41-12 28-8 16-20Z" />
            <path className="bible-vine-leaf-stem" d="M5-5C1-14-4-20-11-25" />
            <path className="bible-vine-leaf-shape" d="M-11-25C-17-43-34-45-44-34C-37-17-23-13-11-25Z" />
          </g>
          <g id="bible-vine-grape-sprig">
            <path className="bible-vine-grape-stem" d="M0 0C14 7 5 18 15 25C23 30 34 23 40 16" />
            <circle className="bible-vine-grape-berry light" cx="3" cy="28" r="8" />
            <circle className="bible-vine-grape-berry" cx="18" cy="29" r="8.5" />
            <circle className="bible-vine-grape-berry light" cx="32" cy="32" r="7.5" />
            <circle className="bible-vine-grape-berry" cx="-4" cy="41" r="8.5" />
            <circle className="bible-vine-grape-berry" cx="11" cy="43" r="9" />
            <circle className="bible-vine-grape-berry light" cx="27" cy="44" r="8.5" />
            <circle className="bible-vine-grape-berry" cx="41" cy="45" r="7.5" />
            <circle className="bible-vine-grape-berry light" cx="0" cy="56" r="8" />
            <circle className="bible-vine-grape-berry" cx="15" cy="57" r="9" />
            <circle className="bible-vine-grape-berry" cx="31" cy="58" r="8.5" />
            <circle className="bible-vine-grape-berry light" cx="43" cy="59" r="7" />
            <circle className="bible-vine-grape-berry" cx="6" cy="70" r="8" />
            <circle className="bible-vine-grape-berry light" cx="21" cy="71" r="8.5" />
            <circle className="bible-vine-grape-berry" cx="35" cy="72" r="7.5" />
            <circle className="bible-vine-grape-berry" cx="12" cy="83" r="7.5" />
            <circle className="bible-vine-grape-berry" cx="26" cy="84" r="8" />
            <circle className="bible-vine-grape-berry light" cx="18" cy="96" r="7.5" />
          </g>
          {grapeProgresses.map((itemProgress, index) => (
            <clipPath key={index} id={`${grapeClipPrefix}-${index}`} clipPathUnits="objectBoundingBox">
              <rect className="bible-vine-grape-reveal" x="0" y="0" width="1" height={itemProgress} />
            </clipPath>
          ))}
        </defs>

        <g className="bible-vine-stems">
          {VINES.map((vine, vineIndex) => {
            const vineProgress = vineProgresses[vineIndex]
            return (
              <g key={vine.path}>
                <path className="bible-vine-drawing-path" pathLength="1" style={drawingStyle(rangeProgress(vineProgress, 0, 0.78))} d={vine.path} />
                {vine.branches?.map((branch, branchIndex) => {
                  const start = 0.5 + branchIndex * 0.08
                  return (
                    <path
                      key={branch}
                      className="bible-vine-drawing-path"
                      pathLength="1"
                      style={drawingStyle(rangeProgress(vineProgress, start, Math.min(1, start + 0.42)))}
                      d={branch}
                    />
                  )
                })}
              </g>
            )
          })}
        </g>

        <g className="bible-vine-tendrils">
          {VINES.map((vine, vineIndex) => vine.tendrils?.map((tendril, tendrilIndex) => {
            const start = 0.64 + tendrilIndex * 0.08
            return (
              <path
                key={tendril}
                className="bible-vine-drawing-path"
                pathLength="1"
                style={drawingStyle(rangeProgress(vineProgresses[vineIndex], start, Math.min(1, start + 0.3)))}
                d={tendril}
              />
            )
          }))}
        </g>

        <g className="bible-vine-leaves">
          {VINES.map((vine, vineIndex) => (
            <g key={vine.path}>
              {vine.leaves.map((transform, leafIndex) => (
                <use
                  key={transform}
                  className="bible-vine-leaf-sprig-use"
                  href="#bible-vine-leaf-sprig"
                  transform={transform}
                  style={leafStyle(vineProgresses[vineIndex], leafIndex, vine.leaves.length)}
                />
              ))}
            </g>
          ))}
        </g>

        <g className="bible-vine-grapes">
          {GRAPE_SPRIGS.map((grape, index) => (
            <use
              key={`${grape.x}-${grape.y}-${grape.rotation}`}
              className="bible-vine-grape-use"
              href="#bible-vine-grape-sprig"
              transform={`translate(${grape.x} ${grape.y}) rotate(${grape.rotation}) scale(${grape.scale})`}
              clipPath={`url(#${grapeClipPrefix}-${index})`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
