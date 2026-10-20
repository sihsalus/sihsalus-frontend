# WHO Growth Reference 2007

Source: World Health Organization, retrieved 2026-09-23. The four JSON files retain
only Month, L, M and S from the first worksheet of the official expanded tables.
The 168 consecutive monthly rows from 61 through 228 remain unchanged. Each file
now also includes month 60 from WHO’s official AnthroPlus implementation; the
application does not extrapolate the printed tables backwards.

| JSON             | Official spreadsheet                                                                                                                                                                   | SHA-256 of downloaded XLSX                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `bmi-boys.json`  | [BMI boys](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-%285-19-years%29/bmi-boys-z-who-2007-exp.xlsx?sfvrsn=a84bca93_2)         | `0a60849673f34a06b8e2fe4defe5d00348de687b6c9fce0278f1525fff89eb6d` |
| `bmi-girls.json` | [BMI girls](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-%285-19-years%29/bmi-girls-z-who-2007-exp.xlsx?sfvrsn=79222875_2)       | `66f5c6284b44579ad6135fc639f22c09e36fe5a695b04390377113f6a00deb72` |
| `hfa-boys.json`  | [Height boys](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-%285-19-years%29/hfa-boys-z-who-2007-exp.xlsx?sfvrsn=7fa263d_2)    | `d78fa8cafcab77dcb5f03d71506d92bdcb28f89c642816b6bb0eef466b007466` |
| `hfa-girls.json` | [Height girls](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-%285-19-years%29/hfa-girls-z-who-2007-exp.xlsx?sfvrsn=79d310ee_2) | `df07ee16d3d2916569f1d869b7c874d7b880a41321d871215ed0254cb16679b3` |

The existing graph derives reference lines and percentiles from these LMS values.
Patient age is measured at the observation, in days / 30.4375, and monthly LMS
parameters are interpolated linearly. Values outside the supplied age range are
not extrapolated. BMI needs positive weight in kg and height in cm from the same
encounter; missing encounter identity does not produce a derived BMI.

[WHO's computation instructions](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf)
define LMS and the restricted BMI tails beyond ±3 SD. The three worked examples
are tested to 0.01, accounting for the source's rounded intermediate measurements.
[WHO's school BMI cutoffs](https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age)
are distinct from preschool cutoffs. Tests also cover sex-specific medians,
fractional ages, invalid input, separate encounters and reference boundaries.

This is a read-only interpretation of a chart. Structured z-score/classification
observations, their canonical concepts, backend validation and clinical acceptance
remain tracked in [issue #58](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/58).
The existing preschool reference data and calculations are unchanged.

## Month 60 from the official WHO AnthroPlus implementation

Retrieved 2026-10-19 at WHO commit
[`7cfcdb39026e9a55de55732bc3cf14c82261bcf7`](https://github.com/WorldHealthOrganization/anthroplus/tree/7cfcdb39026e9a55de55732bc3cf14c82261bcf7).
Only the month-60 row for each sex was added, with its original L, M and S values.
The existing LMS interpolation now operates between supplied rows 60 and 61.
WHO’s [release notes](https://github.com/WorldHealthOrganization/anthroplus/blob/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/NEWS.md)
state that version 1.0.0 added support for observations aged 60 months and above.
The monthly XLSX downloads above omit this row; changing only the age threshold
would still leave measurements between 60 and 61 months unrepresented.

| Source                                                                                                                                                          | SHA-256 of the downloaded source                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [BMI](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/bfawho2007.txt)    | `70ef3260df08e48ce560c28cff4e733db78fb952cbd881eba63c9d3a15f38a6a` |
| [Height](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/hfawho2007.txt) | `9ac02aa4908f8ec3c6ba2362a4c7e1356043408b2873548ca22eedc016c235ad` |

Age selection and plotting both use exact age in WHO months (days / 30.4375).
This chart remains a reference display requiring domain review; it writes no
z-score, diagnosis or classification observation.
