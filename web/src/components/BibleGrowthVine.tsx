import { useId, type CSSProperties } from 'react'
import { getGrowthRevealRadius } from '../lib/bible-growth'

export function BibleGrowthVine({ progress, grapeProgress }: { progress: number; grapeProgress: number }) {
  const grapeClipId = `bible-grape-reveal-${useId().replaceAll(':', '')}`
  if (progress <= 0) return <div className="bible-library-vine-anchor" aria-hidden="true" />

  const style = {
    '--bible-vine-reveal-radius': `${getGrowthRevealRadius(progress)}%`,
  } as CSSProperties
  const grapeRevealRadius = getGrowthRevealRadius(grapeProgress) * 10

  return (
    <div className="bible-library-vine-anchor" aria-hidden="true">
      <svg className="bible-library-growth-vine" style={style} viewBox="0 0 1000 1000">
        <defs>
          <clipPath id={grapeClipId}>
            <circle className="bible-grape-reveal" cx="500" cy="500" r={grapeRevealRadius} />
          </clipPath>
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
        </defs>

        <g className="bible-vine-stems">
          <path d="M500 500C430 500 478 411 414 382S314 358 332 300S246 250 286 188S235 139 166 116C122 98 78 102 54 126C36 144 40 173 62 188" />
          <path d="M500 500C435 470 432 431 474 367S395 309 435 250S362 166 303 118C275 94 237 95 210 113C190 128 185 154 197 175" />
          <path d="M500 500C450 445 548 407 488 347S547 269 496 211S551 166 505 122C480 104 454 116 447 143" />
          <path d="M500 500C475 430 570 423 534 354S612 299 575 244S648 166 702 118C731 96 769 96 796 115C817 130 823 156 811 177" />
          <path d="M500 500C500 430 531 409 603 390S670 316 731 331S802 257 837 198S901 178 930 146C956 131 968 145 966 166C964 187 946 202 925 198" />
          <path d="M500 500C525 435 604 536 674 477S766 501 813 440S897 440 950 348C972 329 976 302 962 284C948 267 926 267 912 284" />
          <path d="M500 500C550 450 350 360 490 292S660 185 790 122C832 87 882 87 913 115C946 146 936 191 903 210C875 226 844 210 840 184C837 161 855 144 875 149" />
          <path d="M500 500C565 480 628 466 698 531S785 520 842 579S901 590 950 661C972 681 976 709 961 728C946 746 920 747 904 730" />
          <path d="M500 500C570 500 501 603 576 646S610 739 684 751S725 836 811 900C837 930 875 948 906 933C930 921 940 895 929 875" />
          <path d="M500 500C565 530 454 599 520 665S453 759 510 823S465 897 514 930C488 951 458 944 448 920" />
          <path d="M500 500C550 555 492 612 419 646S381 728 319 749S281 836 191 900C164 930 126 948 94 933C70 921 60 895 71 875" />
          <path d="M500 500C525 570 381 470 307 529S218 511 158 568S99 580 50 648C28 628 24 600 39 581C54 563 80 562 96 579" />
          <path d="M500 500C500 570 650 360 510 292S340 185 210 122C168 92 118 95 86 128C58 157 68 199 98 218C123 234 154 223 164 198C173 175 159 153 139 151" />
          <path d="M500 500C475 565 392 533 325 475S236 492 184 433S101 431 50 339C28 320 24 293 38 275C52 258 74 258 88 275" />
          <path d="M500 500C450 550 643 632 508 703S353 813 275 920C235 954 182 958 151 930C121 901 133 861 167 848C201 835 230 859 224 887C219 911 193 925 175 911" />
          <path d="M500 500C435 525 357 632 492 703S647 813 725 920C765 954 818 958 849 930C879 901 867 861 833 848C799 835 770 859 776 887C781 911 807 925 825 911" />
          <path d="M414 382C361 424 322 365 275 406S198 381 145 326" />
          <path d="M332 300C386 270 369 218 322 223S270 190 230 142" />
          <path d="M474 367C520 330 564 384 611 341S663 309 709 263" />
          <path d="M488 347C437 315 410 359 365 326S316 284 267 274" />
          <path d="M534 354C583 318 614 361 657 327S710 291 758 260" />
          <path d="M603 390C650 434 687 379 735 417S798 390 843 350" />
          <path d="M674 477C718 526 760 475 806 517S878 493 928 526" />
          <path d="M698 531C646 575 692 622 747 598S818 626 868 682" />
          <path d="M576 646C522 690 564 745 620 724S681 760 718 811" />
          <path d="M419 646C471 688 432 744 377 726S316 765 280 816" />
          <path d="M307 529C264 484 222 535 177 498S111 492 65 456" />
          <path d="M325 475C279 526 237 478 193 521S126 545 77 597" />
        </g>

        <g className="bible-vine-tendrils">
          <path d="M270 238C231 221 224 187 246 176C269 165 279 198 257 207" />
          <path d="M412 378C374 368 361 337 379 323C399 308 416 336 397 350" />
          <path d="M451 341C474 316 469 283 448 279C425 274 425 306 447 309" />
          <path d="M588 367C620 354 634 323 615 310C594 296 579 326 602 337" />
          <path d="M817 327C846 316 859 286 842 273C821 259 805 286 826 300" />
          <path d="M690 480C717 503 747 497 750 476C752 453 720 454 719 476" />
          <path d="M676 572C701 548 733 553 736 575C740 600 708 603 704 580" />
          <path d="M596 651C623 666 627 697 608 708C587 721 573 692 594 680" />
          <path d="M402 641C376 659 374 691 395 700C418 710 428 679 405 670" />
          <path d="M326 573C300 551 269 559 268 581C268 605 299 605 301 583" />
          <path d="M324 478C297 499 267 492 264 470C261 446 293 445 296 468" />
        </g>

        <g className="bible-vine-leaves">
          <use href="#bible-vine-leaf-sprig" transform="translate(500 500) rotate(8) scale(.44)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(414 382) rotate(205) scale(.55)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(332 300) rotate(142) scale(.58)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(286 188) rotate(220) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(166 116) rotate(172) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(474 367) rotate(248) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(435 250) rotate(185) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(303 118) rotate(215) scale(.54)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(488 347) rotate(304) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(496 211) rotate(238) scale(.55)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(505 122) rotate(275) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(534 354) rotate(332) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(575 244) rotate(290) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(702 118) rotate(318) scale(.54)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(603 390) rotate(24) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(731 331) rotate(306) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(837 198) rotate(20) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(930 146) rotate(332) scale(.46)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(674 477) rotate(35) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(813 440) rotate(302) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(950 348) rotate(338) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(490 292) rotate(198) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(790 122) rotate(322) scale(.55)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(698 531) rotate(48) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(842 579) rotate(10) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(950 661) rotate(42) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(576 646) rotate(58) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(684 751) rotate(24) scale(.57)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(811 900) rotate(55) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(520 665) rotate(118) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(510 823) rotate(62) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(514 930) rotate(98) scale(.47)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(419 646) rotate(142) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(319 749) rotate(192) scale(.57)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(191 900) rotate(148) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(307 529) rotate(158) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(158 568) rotate(202) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(50 648) rotate(160) scale(.46)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(510 292) rotate(18) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(210 122) rotate(205) scale(.54)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(325 475) rotate(218) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(184 433) rotate(172) scale(.56)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(50 339) rotate(198) scale(.47)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(508 703) rotate(135) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(275 920) rotate(168) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(492 703) rotate(45) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(725 920) rotate(12) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(275 406) rotate(172) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(145 326) rotate(205) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(322 223) rotate(146) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(230 142) rotate(198) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(611 341) rotate(18) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(709 263) rotate(328) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(365 326) rotate(208) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(267 274) rotate(164) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(657 327) rotate(32) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(758 260) rotate(315) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(735 417) rotate(44) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(843 350) rotate(326) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(806 517) rotate(55) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(928 526) rotate(18) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(747 598) rotate(68) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(868 682) rotate(38) scale(.52)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(620 724) rotate(82) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(718 811) rotate(28) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(377 726) rotate(188) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(280 816) rotate(142) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(177 498) rotate(202) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(65 456) rotate(166) scale(.5)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(193 521) rotate(155) scale(.48)" />
          <use href="#bible-vine-leaf-sprig" transform="translate(77 597) rotate(212) scale(.5)" />
        </g>

        <g className="bible-vine-grapes" clipPath={`url(#${grapeClipId})`}>
          <use href="#bible-vine-grape-sprig" transform="translate(500 500) rotate(-12) scale(.72)" />
          <use href="#bible-vine-grape-sprig" transform="translate(414 382) rotate(18) scale(.65)" />
          <use href="#bible-vine-grape-sprig" transform="translate(332 300) rotate(24) scale(.72)" />
          <use href="#bible-vine-grape-sprig" transform="translate(435 250) rotate(-18) scale(.68)" />
          <use href="#bible-vine-grape-sprig" transform="translate(488 347) rotate(12) scale(.64)" />
          <use href="#bible-vine-grape-sprig" transform="translate(575 244) rotate(20) scale(.7)" />
          <use href="#bible-vine-grape-sprig" transform="translate(603 390) rotate(-16) scale(.65)" />
          <use href="#bible-vine-grape-sprig" transform="translate(731 331) rotate(-24) scale(.67)" />
          <use href="#bible-vine-grape-sprig" transform="translate(674 477) rotate(16) scale(.64)" />
          <use href="#bible-vine-grape-sprig" transform="translate(698 531) rotate(18) scale(.7)" />
          <use href="#bible-vine-grape-sprig" transform="translate(576 646) rotate(-18) scale(.65)" />
          <use href="#bible-vine-grape-sprig" transform="translate(620 724) rotate(-22) scale(.68)" />
          <use href="#bible-vine-grape-sprig" transform="translate(520 665) rotate(16) scale(.64)" />
          <use href="#bible-vine-grape-sprig" transform="translate(419 646) rotate(-16) scale(.65)" />
          <use href="#bible-vine-grape-sprig" transform="translate(377 726) rotate(24) scale(.68)" />
          <use href="#bible-vine-grape-sprig" transform="translate(325 475) rotate(18) scale(.64)" />
          <use href="#bible-vine-grape-sprig" transform="translate(307 529) rotate(-18) scale(.7)" />
          <use href="#bible-vine-grape-sprig" transform="translate(286 188) rotate(-22) scale(.58)" />
          <use href="#bible-vine-grape-sprig" transform="translate(267 274) rotate(20) scale(.6)" />
          <use href="#bible-vine-grape-sprig" transform="translate(496 211) rotate(-10) scale(.59)" />
          <use href="#bible-vine-grape-sprig" transform="translate(702 118) rotate(18) scale(.58)" />
          <use href="#bible-vine-grape-sprig" transform="translate(837 198) rotate(-22) scale(.6)" />
          <use href="#bible-vine-grape-sprig" transform="translate(813 440) rotate(15) scale(.61)" />
          <use href="#bible-vine-grape-sprig" transform="translate(842 579) rotate(-15) scale(.62)" />
          <use href="#bible-vine-grape-sprig" transform="translate(868 682) rotate(22) scale(.58)" />
          <use href="#bible-vine-grape-sprig" transform="translate(684 751) rotate(-16) scale(.61)" />
          <use href="#bible-vine-grape-sprig" transform="translate(718 811) rotate(18) scale(.57)" />
          <use href="#bible-vine-grape-sprig" transform="translate(510 823) rotate(-12) scale(.6)" />
          <use href="#bible-vine-grape-sprig" transform="translate(319 749) rotate(20) scale(.62)" />
          <use href="#bible-vine-grape-sprig" transform="translate(280 816) rotate(-18) scale(.57)" />
          <use href="#bible-vine-grape-sprig" transform="translate(158 568) rotate(16) scale(.59)" />
          <use href="#bible-vine-grape-sprig" transform="translate(184 433) rotate(-20) scale(.58)" />
        </g>
      </svg>
    </div>
  )
}
