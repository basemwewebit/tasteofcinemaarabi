// data/style-guide.ts
// Typed editorial rules configuration for certified-quality Arabic translation.
// Referenced by prompt builders in src/lib/ai/prompts/.

export interface StyleGuideConfig {
    /** Overall editorial tone description */
    tone: string;
    /** Language register and level */
    languageLevel: string;
    /** How to handle foreign names (directors, actors) */
    foreignNames: string;
    /** How to handle film/show titles */
    filmTitles: string;
    /** Quotation mark style and rules */
    quotations: string;
    /** Numeral rendering rules */
    numerals: string;
    /** Addressing style (direct, third-person, etc.) */
    addressingStyle: string;
    /** Additional editorial directives as an array of rules */
    additionalRules: string[];
}

export const STYLE_GUIDE: StyleGuideConfig = {
    tone: 'أسلوب صحفي أدبي رفيع يليق بمجلة سينمائية متخصصة — كمجلة \"الفن السابع\" أو \"سينماتيك\". النبرة جادة ورصينة لكن ليست أكاديمية جافة، مع لمسة أدبية تجعل القراءة ممتعة.',

    languageLevel: 'فصحى عربية معاصرة — وسط بين اللغة الأكاديمية الجامدة والأسلوب الشعبي المبسّط. لا تقعّر ولا عامية. استخدم مفردات غنية ومتنوعة مع الحفاظ على سلاسة الجمل.',

    foreignNames: 'أسماء المخرجين والممثلين والمنتجين تبقى بلغتها الأصلية كما هي — لا تعريب صوتي أبداً. مثال: Martin Scorsese وليس مارتن سكورسيزي.',

    filmTitles: 'أسماء الأفلام والمسلسلات والأعمال السينمائية تبقى بلغتها الأصلية كما هي. لا تُترجم أبداً. مثال: Taxi Driver وليس سائق التاكسي.',

    quotations: 'الاقتباسات المباشرة تُوضع بين علامات تنصيص عربية «». تُترجم الاقتباسات بأسلوب يحافظ على روح المتحدث. مثال: قال Scorsese: «السينما مسألة ما يُكشف وما يُخفى».',

    numerals: 'الأرقام تُكتب بالأرقام اللاتينية: 0123456789. مثال: صدر عام 1994، وحقق إيرادات 230 مليون دولار.',

    addressingStyle: 'لا مخاطبة مباشرة للقارئ (تجنّب \"أنت\" و\"عزيزي القارئ\"). استخدم صيغة الجمع الغائب أو المبني للمجهول. مثال: يمكن للمشاهد أن يلاحظ... بدلاً من: يمكنك أن تلاحظ...',

    additionalRules: [
        'تجنّب الترجمة الحرفية تماماً — أعد صياغة الجمل بما يناسب البنية العربية الطبيعية.',
        'استخدم أدوات الربط العربية بتنوّع: \"إذ\"، \"حيث\"، \"لا سيّما\"، \"فضلاً عن\"، \"علاوةً على\" — ولا تكرر نفس أداة الربط.',
        'تجنّب \"تم + مصدر\" (مثل: تم تصوير) واستخدم المبني للمجهول (صُوِّر) أو صيغة فعلية مباشرة.',
        'استخدم التأنيث والتذكير بدقة حسب قواعد اللغة العربية.',
        'لا تبدأ الجملة بفعل مضارع مسبوقاً بـ\"هو\" أو \"هي\" إلا عند الضرورة — ابدأ بالفعل مباشرة.',
        'المصطلحات السينمائية التي ليس لها مقابل عربي متفق عليه تُستخدم كما هي بحروفها الأصلية مع شرح مختصر عند أول ذكر.',
        'الفقرات يجب أن تكون متماسكة ومترابطة — لا جمل متقطعة أو مفككة.',
        'عند ذكر عدد أفلام أو عناصر في قائمة، استخدم صيغة العدد العربية الصحيحة (التمييز بحسب العدد).',
    ],
};
