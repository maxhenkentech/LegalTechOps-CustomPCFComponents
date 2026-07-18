# Markdown Format Reference

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Each section below exercises **one**
supported Markdown feature on its own, and the final section combines several features together
in the same block - e.g. bold and italic text inside an alert callout.

## Headings

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
labore et dolore magna aliqua.

### Heading Level 3

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
consequat.

#### Heading Level 4

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
pariatur.

##### Heading Level 5

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
est laborum.

###### Heading Level 6

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

## Emphasis

Lorem ipsum dolor sit amet, *consectetur adipiscing elit* (italic), **sed do eiusmod tempor**
(bold), and ~~incididunt ut labore~~ (strikethrough). Bold and italic can also be combined into
***one run of text*** for extra emphasis.

## Links

Lorem ipsum dolor sit amet - see the [Change Management Policy](https://example.com/policy) for
consectetur adipiscing elit, or read more at <https://example.com/autolink> (a bare autolink).

## Lists

Unordered list:

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
  - Sed do eiusmod tempor incididunt (nested)
  - Ut labore et dolore magna aliqua (nested)
- Ut enim ad minim veniam

Ordered list:

1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
   1. Sed do eiusmod tempor (nested)
   2. Incididunt ut labore et dolore (nested)
3. Magna aliqua ut enim ad minim

## Task Lists

- [x] Lorem ipsum dolor sit amet
- [x] Consectetur adipiscing elit sed do eiusmod
- [ ] Tempor incididunt ut labore et dolore magna
- [ ] Aliqua ut enim ad minim veniam quis nostrud

## Blockquotes

> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
> labore et dolore magna aliqua, ut enim ad minim veniam quis nostrud exercitation.

## Alert Callouts

> [!NOTE]
> Lorem ipsum dolor sit amet, consectetur adipiscing elit.

> [!TIP]
> Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua - ut enim ad minim veniam,
> quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
> irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur,
> excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.

> [!IMPORTANT]
> Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim
> id est laborum.

> [!WARNING]
> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
> laudantium.

> [!CAUTION]
> Totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae
> dicta sunt explicabo.

## Inline Code &amp; Fenced Code Blocks

Lorem ipsum `dolorSitAmet` is a variable name, referenced inline like consectetur adipiscing elit.

```json
{
  "loremIpsum": "dolor sit amet",
  "consectetur": "adipiscing elit",
  "sedDo": 12,
  "eiusmodTempor": true
}
```

```typescript
function loremIpsum(dolorSitAmet: string, consectetur: number): string {
  return `${dolorSitAmet} - adipiscing elit ${consectetur}`;
}
```

## Tables

| Lorem Ipsum      | Dolor Sit Amet | Consectetur | Adipiscing Elit |
| ----------------- | -------------- | :---------: | ---------------- |
| Sed do eiusmod     | Tempor         | 2 days      | ops@example.com  |
| Incididunt ut      | Labore         | 3 days      | ops@example.com  |
| Magna aliqua       | Enim ad minim  | 5 days      | contracts@example.com |
| Veniam quis        | Nostrud        | Same day    | oncall@example.com |

## Images

![HenkenTech logo](<data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAABNCAYAAADXeb3AAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAUoAAAABAAABSgAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAABQKADAAQAAAABAAAATQAAAAAUeNICAAAACXBIWXMAADLAAAAywAEoZFrbAAACzmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj4zMzA8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjMzMDwvdGlmZjpYUmVzb2x1dGlvbj4KICAgICAgICAgPHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjUwMTQ8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjE8L2V4aWY6Q29sb3JTcGFjZT4KICAgICAgICAgPGV4aWY6UGl4ZWxZRGltZW5zaW9uPjEyMTA8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KMv8rtQAAGgtJREFUeAHtnQmYHFW5hrtnJguEsCTsRAgQZFHEB68BIWwB1AgqyPIIXAICgoAosskaAoLIJgooq4Bcea6oXLmAgIgQEBQFhCsQdrIQdtmzQCYzfd+30yf0dKqqq2d6OhrO//hOVZ39fPWf/5zuGWKhEC0qEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVKB/FSj2b/MftF4qFBL7IpGsbOtl3cT+sntKzM0an32E/Or+Qlpig1WJ1XWqkhe0WZ0W7ntTp17dMI/acaf1FdrLe61tN9QL7Yf88Gx+SAtl067VdarL5K1fXSfcp7UZ8sPVPhopG+qFa966oXzStbfzbKOxjgqOw3a6KszjmtfS5pBnXH2pm3d8meUUoN+ttMlhSxeGDR9RaGv/QJTurmKh2DGrcPOJ07IGQIW2wpcmrlXoLAzsUZ9KpTeGTC3+5Yg5KfVXIH15i6Xk10v25bwHz6UUtH2ZBc4h9NfN/VSwbpYNJHMtqHUCnfBZ8JpkI0gcCtXzso2X4E1IMvNXgWWhul51WecwuzqB+zCntDo1xRd6tN96GvqO3oXnYSUYBmo4Bd6HLOuthlltmrcyLAdp83ZeajUV6ulq2eAj3C6wIdytAWl9LChY50ad6vladRODedB/nOPa4Ds2bS7oPy/AdPCdOO5OSLO+6r8aDS8N1Rqo18vwBvS7tSQAFoYvvw3B67JCFxtLkfmVmG87XXd13s8Md8ic5RcnDuYV/KpQbBtR6CYmhPpWGvbqOH4+mFL/INIPS8nLm/w0BbeCpB1xP9KPBB1mN1gdrgCdaQJcDi7kNPPl/wEG1RR4m+fN4dWa9PB4Fjfbhoeq61HcX131HG51qNFwPqwZEmuut/N8ONQGwG+RdmBN2UYfH6PCdpAU0MM7csHtCuvBJeDCOgGuhOrFwWMPG8nTndDeI7VQeJ3nMeC1N+Z7HV+n4v+Rvz2cCI49y+4lc+eaAhvzfF1NWqOP+pdjeCRHRf3SgPcFcN1sBAb5TrAd/cR4YCCcAX+D2+A+mAZJm9EI0nvjw1Qr2/f5+fnKffXleB4ur07or3sn3P9W6kL8jhWQeF6h2P5UodjNrlOE8m6f3f/7Q4qFjpnDC21tK7AUZhAAZxW6uz9KpWKhNCBr/EMpYx+zYCr4krMWE9kLzFPJquAC0jGSbCkSbV++A0eDzrJ75f4Ors9Amjl2d2GvnvhcxCPBxd8GaeYpzj4d28uwDlhnCUiydUk8EwyCOvIscCEYeNXjITgbkgJumONM8q3biIaO0dORWqZZeEeWNQDr+A+CweIoMLhNgTQbQMaKoF5q7fMa4DuT3toyVHRM78BUCOY7Mt0+PalqnmBMextmQLVGzt88A02t+c7Ms7xjn1u551LXWE8F14CWtQbml5h/4hvLwxGwJTjWl+BR0I/sW+2cy3Bwbl+BXcAAdxncDrWfttJ82LayfJjssqmLGnjyfBFGgX7p6bgllke8vg+k2MZCK//vzUKp+xDYuzBgwP74aNKpYOH+SmUnYa+adzmv++FCd+nXnCgVOct0LO0p+DYsCTpdHnOX/AaENpLqVOeNp8B1cDqMAV+kp6djIO3jCYKUT0W+g1PARXcBVLfL40IW8u8gx/LXwEfA9mrNdMe0FTwP3wMDw2ngx80nwUXxECRZaHMymQakRjT8MuV5x4knP5LLFubiw77wG3CMm8L6cCicAEmnD5LLc7YNF9sEMOCcC2Hc3PbKwrgeo/YZlRZMM3DsBdW+Efr6K+nq6uINvrkP9waR0B63CyzUM6gcDe+CG04e872eD847tJNWz3e2G+gHbkZPwO/hTjAIatXByvLrwFZgEPwibABjYTpUm327hhv14dCGdbVJcB78HNaEJL1Ibr458NaYH13daW6ZcHdhhwljyh9lG+m5yDtqK0wuDOn8c2HmgEYEeoNu/gTjwUWVx9auFCoPuk4FnUDHPQl0mIvgZLC/6+EOqGf3U0DnbMSep7Dzmp1SyQB3IjimV8GF7C5+NniCsb75d0E985RgX/vDqHqFK/k6spZXQzeACbA7eOLwNLgfqOE9UM8MQKHPemXr5YcxD6fgZpXCBuFTweCcZK+QqEaHwaqVAqtVrqG9ymOPyzye7oa14bM9ctIfPDVltRlqtnPzBTgLhoLjOxOeBeexE6wL5nWCc3gE7oILYRtYGR6E1yDLeuPDoT1Pf45tVkho1bV1ATDMaOuJ7YWu7o6FvrUJ+dnXjsKctrynuNASkbNsX+XnONDh0k4U5YKVH76MPOU8FWjumHuCAfBLMBqOBU9Xb0KWOadwasgqV52nc2tJC2FZ0g+F/eEt+Cn8Fk4DTwM6uvfXQR4LGnr6cVG4WObmqJhXQ8doH2NhV7gAdoSN4TiwX8tkWW80TGvPuTn21eCwSiGffwBBi0rygktIr91orZelle9PNgH9xQ11NtSzOZUC3RkFP0qe73kY3AWHwJJgQNwBXAv6pn6uP40A38GB8CSsCC+D5UN/3CZaX/TP8uXEzpqV2PoA2KyRN96Oi1Z7Gv5Svqv/w48IWQ5mC5PhCfgaHAm3gKetq0Fn2h0ug3rtUKRP5iLShsDecBTo2NfAT+E7sB/o8O7uP4NGLSxkNbwvZ+UZlHNRZ9k/yJwGjvu78AfwpOIYPweeYq+Eeu1QpCnmacZAUd3fuzx3QRtk2Q1kOp9q0z/qmW1rbqj/C+HZtDRzfGkbgwHpCFgXngP9wU32Yvg0qPe98Dd4DQbD6rAxbAifAn3qv8AT4GJpiygAtoXFuihEvYtOv9lAx/Uc0SBzNmwDa8LRYLC5EfYAg+If4RnoD1NLF4I7tE7/RZgI7qrXw/dhL3Acs+EXcA7UmxdFUs0AZXt5rV7wd+yeMtRwFLhwPQ3dCp4IXbx3whRohbno1anW1Ey9s0y9a833U89Cu57ODwJPZ3ksTduPU9nNtxMuAIOgczL4eX8aXAv6RLUN42EHOBCWhZ9Aoxbm0mi9lpevt5v1z4BK/D1LsTiXZZv28vqjX/vSGXTiRqg3FoOOO7ynLIPhf8Jm4MelF2Ed8Bci7rD9Yb7Dx+Eh2AI8OS0Dd8NxYFA5BVyEnixOhvegN6ZuaujibKaGg2jvMbgYPGXuCy5Ug4karg+HguVaYfpK0vzy9J1UL4+fB22df1IbaWlJwdUAtCcsDc/ClbAzjIN34FQwrTb4kVT++zs3gANB/5kGec2xOH59JGlcedtpWbnWB8DX+AhR6noKfW5mlvfUnemgpZsl5AP0dQs8UrfP3hW4gmr3w1IwAV6Ai0BnGA+bQbNNR9dBddQOOA9Wh4fhaDD4ejr149wkOBb8CNxbc35qaMDtD7uURg3kLtwTYQpcDgbc/cCguDiap/XpoLZ3Q199Xh/cEbRfgxvzwaC/2IcnwXrmO76pXqGqfGPJP8F1fSvYZz3r6zzrtV8330XTOivxHcTqfMfQPeDpQudcTkhd3aXPnbRR5gDmvjSo0FYckFkmX6aO8Edwh/pEvirlPxN4LWdZX7invmtgS9gDLoIvwWgw+Li4+xKAqN7DdLozwCBo8PC7m6fAj4wD4cewMvg9j2nPQ1/sl1TWuRvR0I3g9ZydzqGc87katoXdwI9vLma/m1LDveBtWJzMd6VvfB+64WOQx96lkJtEra1Bgu9dX7sRNoCNwPd2CXiabJaFIGYfj4FrQHMMkmXLZGW2Iq81AbDE38AoU3txWa6XFDraOBWR4J/ylep8qVz072f4w2nrl0ruYL21g6g4plLZwJHHzqeQHwfy2DYUuhN+A/vBkeBuGxb0WO53h8tAJ++rqYWO/CT8ELaGGeDJ6SW4CtaFyeBp8FHoqx1CA5tUGsmr4bmUN3BmmW9XU0M3qRvAQHcM3AYuqivg87ALXAmhDrf/9ubmuRV8tzKTvNreT3nfSa1Z343YDcX3r++z2Mqbo3WaaWGsE2h0FoT3on9Kmllu7UpmaCOtbL+ltyYAtpXm8IfLUwpdzLm9bWj9X6RVz5dYUSq+UGhvZ7m3zy7M7W7r5Z/Q+D3SaJgJb4AvILwsbheYL20VcFdedUFq/Zs9KMIgy1/mj+W6JriADwd3YfMNii7wZ6BZdgQN7Qp+/DgTHoALYFOYBifAn6AZ5slEDd8FTxdZGqqdi24lyGvjKejHXTeNrWAUqJmBwZOn8zwK7oQpsLgYTl7WSW05HJT/9MQ09U2yYSQuDb6HJJtN4q/BNmxza9Amg/7fLHMDdtN1zbhepBFzHcpbjVRqZtnWBMDOjofwa5wYvfzveXtjLouujgcLg+Z15P79WM9+dCztdrgQPH4nzd+X6QI0gDUy2CGU97SzA7hIr4R94O9wHHga+xScAy70Rtqm+EIWFseOlZzLuV4G14JjeA88+V0PzbKgocHoEkjTMGwEIyjjIsxrbI6FH4FzcuzO6QDAf8qbySiun4Sz4GvQVw1p4l/Ggk4vMiLnPAj0qSTbm0Q1mpeUSdrX4cCqvNDO9Kq0Zty+SiO+J993X+xZKietxb60matuazod8P6K/BJ0Wz7ChkWba3A9CvlRuDh7Gi7/So/0xh9mUOWPMAFWTqnuQmzUDA5rw5fhAvA3rjrqt+FOMDgaoLaHnWASNMPCwnmGxrx3l7cPnXI9WAqauevTXPlkqYanwvIm1JibyJKVNO/zmgvajcIAbvC7Cb4Kh8MkMDheBOPAAHA/LG7mx8jbYXfYGmrNNTSiNrHmWf9dFl6Ge0BdrfdXaKb5jsdCXwKg/jEQHoaWW2sCYHdxVKGt+6DyvwJT4M9fCsWqQJj1vZ7lzC8NLEtcbL+r0Nb1Qh/3/baKyrtyNUAkmeMzoIXgklQmLc0FPAf8BcQWsD4cCgbcm2E3MCi+CDqmO30zzHk5bk9mfkTaH+z3dbgc0L1pFjR0ka6V0mrQsCslPynZOpoaGggMeJvDhnAwnAZuMDvD4aCmatgaP6ajFljYMMbQ1wEZ/emfzj3JPP1rz8FE8OuI5eBZaKYtQ2OeNg1gSeslzCWpT9/1AAh+e01Sof5Oa43j+I8h+LuMYtHvLC7nH0OYw7cG3eVfahSLGbsHGpX8DXDpAJa2YjfDwku5msZWyGjQcg9m5KdlhUX8EAUMPKfAnuCJ8GzYDDaCg6CZZr/u/FvBuWAQNMgfBX7Pci2EsXHbJwsaXkErw+u0pA6NWhjnA1S0j5NgPNwA58BnwK8TDBChLLeLjRkU7gA30ix7OiXzn5V0A9NjYDD1F0je98anqZZqQf//psQLEDY813Xwk7TKu5CxTlpmK9JbEwCdiQGwm49inXPPLAwa+JFC+8D1C51dr6PXPZkTHTxkcOH9mbtRv1kBMHTnSSkj+JaL1XPA0FbStZvEq2AceIo5GgyELugTwPRmnf5oqnxatb3jwYBxOhgEtwXT3oTfQzMsOPbFNOZizbK+aOhiUi+1Gg1qOB6ugu/CF8BFrtaLk6mp72pSnUmlnQCnVuqN4LpUhZ24bghnggeRZtvPaHA6bAGeBm+HuZBljudDEgCVwVNf18DX+YdRdy0MHPKNwry5/yjeMtGPhalW+swPO/k2oz8cvD+coHYeL5BwHviix4LfZ10GLlxPMM02HW9tMAB+B06BpeHTMAHehvugWfZOsxrKaMdFpYbqtj18BS4FTzSfBK0//GN+y4vmpxuMG0dvN4/J1H0fhsPHYBL4vBroC3dAs+0tGlwBjoHZcBvU84+0AE7V1pg7TeutrX1FOv04uFizbWjXohlj9qgayb2VwteDp7NvwWA4F2ZBM81F43c/D4IBdyL4bBB8AjYDA6ML4t/NfseAb4QlwMDuXH8EvQ0QVF2s7VlmJwNgR3gcHgZ9bz8Iv6DiNtNce7aR14ZS0HW9HjTz003e/hsut2iCS6nUXflzmEWxA4TvLBoWq5cVDHQ/himwPviLCRe0NNN8l+68P4CnYAwY8J6B0+F5+DwcByOhL9bqE5endQPedHCBHQxuKn5MXBytq4+TUi83Xm1nWAo8Qc+FHWAPqBegPC3uAwbQvBbWlus63Oetu0jKte47wEUyvcROh5A6IjEnOfEVkjuTs3KnuvvqgKfCXnADnAObw2rQDPNUpNP5pyPLgyc/P2q/DifDuWBA3A38pcj34DXojbnTN6Lhy5R3UfTFHqDyFeAcxoMangWbwkrQiK1AYXU3IEwFN45/FXNNqm3eTeYtys5MGPy1pO0D68KecDUY/AyIx8AScDu4qXiS1n9MWwU+AduBG6bv7l54FRY7+zAGwNG8xYk536Q7sWVfylk+rZjO/HMwII2Bo0GnvBKOB52vWWaguQaGwbHwVTDQnQ8GRj9C7gsGQYOip4W8Fsa5GRUm5qzUWSnrRtIXU8MrYBxsAi7ivUFd1TOMjdtMc9NxE1gD5sLfQb1mwL+CGZwnQt4A6NjvhFpz0/0f+DocCg/CGeBpcCz4SUAtJsM/Qf3sexRsBBtAGxiMd4GLYLGzjsVuRukTMjDo8H7vKFmmMwwA6/jxta8BkCbKf/f3I64bwjZgYLoUXND+JrOZ5o5+GRjwvgkHgk5+CRgYXRSHwOvgGN6HPGYwU8N1KmTVCRra9g+hrwHQvp6H8AuR7bj/ClwMn4M8vmzQOxm2BjUaBLazNJwCzm1RmQHP/peEvXIMQv9UYwN4UgC0rQvBDd+A5rydo0yDbWBXeA9mQhEMjvrii/BbGAyeGg+CG2EGLFaWx2maO+FJ7Gzjcu9uPfsutXUV2ubNW/CXRj1z055KlYzruD6eVqgmfRWe96tJS3sM7efZsW+hkethHzgM7oCzwI8xOn4jFvoL/dfWfZMEA+5wGA+Hg0HwXFgGdocjwSD4SwjtcbuQhT5+Rc7DC+UmJ6xG8r7JWQulhvbDdaECVQm/497FuCd4mr0L1NBFXK/+9pQRg7Eb20g4oIIbxlTIa6GvLN3ytmXwMZCdnbOC69Zx+26z7B9kngGnwbaVgj/j6lzV7RPgezLwOZ934CV4Ep6BLcEAuCHoQz+AtPn6ackDQ28src3etNVQHYVsjflfwZXYUcaxa5eKG8z/r0Ia6Lr8X9F1jy7M6xhCO+3l/Spf9RUp5k6nyL7YPOauqAUnn/+U/HN5km1/RHJ2j9TZPLnwtoT14QiYBJtAvVMpRXqYpzD7HdojteeDO/mZ4EL5MhwHLrbJMAvWgOPBYGlwTrOVyLAvTxV5NWxkMfjRy/ZXhno2kwJqOAY+Bmp4L2wG60GWBY3dCAwE/wFudPqIGk2FvLYcBR2zGvbFXIM7gcEnr7btlA0+ym2m/ZZcA9w3wSCon94B98M9oA0A/cIg5tW5OabPgKbm+oB5abYdGVm+mFbP9LVALXtb3zZ6ZS0KgN3t/Gsw/NlxablCe8dP+b+1XLIipcft+tZW+Yg4cNDX+Vqis1DsnD/uts6sF+JL1daFn5Tv8gU0i4a69pPWR9DORWX7nqq0UHf+08I/HyLpWLgG9gUdTRs0/1K+pvVpkdC+zjwawikAgRPtKVIPhrdhPJwLLp4hoBlELoUT4RfgIggW5miZ3mroeNtCgzXXMBc3A9tftpIf0muKL3h08R4PV8P+4OLR6ml4F2WOBBfcONgOnONjMAXyWNBkJIUdsx+ftXy+PL+sP4MmS3DvCVbd82y4FCv7ZL33bjltLlwF98IesCd8o3J145sFblb6nHPQL/Rlg5Eb6M/hN6DfVvsGj+U5hHc1ofJs+mDI8mHLaEGzrbjfGMKcgsaW6VdrTUfFjhkEvZvKpz4+wc5/z+Wu6+94c2d18e8I/qHQ3j28/M9pVZ/Ai0VfYJo9SsZNaZk507sp925K2cdJT2rfjzL1zNPW+fDRhIJzSHs/IT0k/SUlf2ookHB9ibSJYLurQK3prDrgzfBaVeYj3CfNsapI3VtfeJqGae/o4TqtGihuhAvBYFZr9pekoUHgPHDTuQ886TjvEyDLl8heYE9yl6SJQbkRU+ekdhppw7LP5ahg4HoCDNi3whawKYyC5cGNQ1+fDa/Cn8GA55yeBf3HQFpr6nwD1MYR20nSv7a+vlwbVC1jny2xPFG6zwMpbX7M0MIySy688OZ1zinedvrzWR2U/McQPnvSyEJHR9hpPig+uzC9OGmip5kk88UOS8poIM2FNg2SXv5w0qXWPGm9UpuY8LwqaX40qTUdcQokOYZl/c5miDc1Zp/2nWWrk+nunGTOdTpUO+4KPBsk+mK2OxU6ExpJe0dvUdaFWM/StFC7qZCk4cqkGzT/Cs7vI/AouPHkMX3KcdfaOyS8XJuY8bwkeSMy8vNmqZN65TVPnsuC8/CU5wl2EPie1MCgNhPcEPSnJA1JLptrciTUxpEs/csVKz/S1kCjc6puM95HBaICdRQwCASrXbwh/cNyVQtPcH6F8mHX4sPyzuM8owJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogJRgahAVCAqEBWICkQFogILKfD/2WrHN1BKOtAAAAAASUVORK5CYII=>)

## Horizontal Rule

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

---

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Font Coloring

Inline HTML color spans - the same `<span style="color:...">` syntax GitHub, Obsidian, and most
other Markdown editors already use, part of standard CommonMark's raw-HTML passthrough rather than
a custom tag invented for this control:

This line has <span style="color:red">red text</span>, <span style="color:#2b8a3e">a hex green</span>,
and <span style="background-color:yellow">a yellow highlight</span> mixed into <span style="color:blue">**bold blue**</span> and regular text.

Only `color`/`background-color` survive, and only on `<span>` - other HTML tags/attributes/style
properties written in the source are stripped rather than rendered, e.g. this `<script>` tag and
this `<div style="color:red">` are both neutralized: <script>alert('unsafe')</script><div style="color:red">still just plain text</div>

## Dynamic Field Tags

A `{!fieldLogicalName}` tag is replaced with that field's own value from the record the control is
placed on, formatted the same way the platform itself would show it:

- Status (a choice field): {!lops_status}
- Money: {!lops_contractvalue}
- Date: {!lops_effectivedate}
- A field with no value set on the record renders as the word "empty": {!lops_emptyfield}

A `{!lookupField:targetField}` tag reads a field off the record that a lookup field on the current
record points to - `lops_parentcontract` is a lookup field, `lops_title`/`lops_status` are fields
on whatever record it points to:

- Parent contract's title: {!lops_parentcontract:lops_title}
- Parent contract's status: {!lops_parentcontract:lops_status}

A tag naming a field that doesn't exist renders a short, visible marker instead of silently
disappearing, so a typo is easy to spot while authoring: {!lops_doesnotexist}

A tag written inside inline code or a fenced code block is left alone, exactly as typed - useful
for documenting the syntax itself without triggering it: `{!lops_status}` stays literal text here.

```
{!lops_status} also stays literal inside a fenced code block.
```

## Combined Formatting

Alert callout combining **bold**, *italic*, ~~strikethrough~~, a [link](https://example.com/policy),
and `inline code` all in one block:

> [!NOTE]
> Lorem ipsum **dolor sit amet**, *consectetur adipiscing elit*, ~~sed do eiusmod~~ tempor
> incididunt - see the [Change Management Policy](https://example.com/policy) and reference
> `loremIpsum.dolorSitAmet` for details.

Alert callout containing a nested list:

> [!WARNING]
> Lorem ipsum dolor sit amet, consectetur adipiscing elit:
>
> - Sed do eiusmod tempor incididunt
> - Ut labore et dolore magna aliqua
> - Ut enim ad minim veniam

Task list item with bold and a link:

- [x] Lorem ipsum **dolor sit amet** - see the [policy](https://example.com/policy) for details
- [ ] Consectetur *adipiscing elit* sed do eiusmod ~~tempor~~ incididunt

Table cell with bold, italic, and inline code combined:

| Lorem Ipsum | Details |
| ------------ | -------- |
| **Dolor sit amet** | Consectetur *adipiscing elit*, see `loremIpsum.config` |
| ~~Sed do eiusmod~~ tempor | Incididunt ut labore, [reference link](https://example.com/policy) |

Heading with inline formatting: **Lorem Ipsum** `dolorSitAmet` *Consectetur*
------

Dynamic field tag combined with other inline formatting - **status is {!lops_status}**, effective
*{!lops_effectivedate}*.

Reference token for support tickets (long unbroken string, wrap test):
LOREM-2026-0716-IPSUMDOLORSITAMETCONSECTETURADIPISCING-ELIT-VERYLONGTRAILINGIDENTIFIERTHATSHOULDWRAP
