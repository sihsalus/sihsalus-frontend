import { type FormField, type QuestionAnswerOption } from '@sihsalus/esm-form-engine-lib';

interface TranslationSection {
  label?: string;
  questions?: Array<FormField>;
}

interface TranslationPage {
  label?: string;
  sections?: Array<TranslationSection>;
}

interface TranslationSchemaLike {
  pages?: Array<TranslationPage>;
  translations?: Record<string, string> | Record<string, Record<string, string>>;
}

function getLanguageTranslations(
  translations: TranslationSchemaLike['translations'],
  langCode: string,
): Record<string, string> | null {
  if (!translations) {
    return null;
  }

  const languageTranslations = translations[langCode];
  return languageTranslations && typeof languageTranslations === 'object' ? languageTranslations : null;
}

export function extractTranslatableStrings(form: TranslationSchemaLike | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  form?.pages?.forEach((page) => {
    if (page.label) {
      result[page.label] = page.label;
    }

    page.sections?.forEach((section) => {
      if (section.label) {
        result[section.label] = section.label;
      }

      section.questions?.forEach((question) => {
        handleExtractQuestion(question, result);
      });
    });
  });

  return result;
}

export function mergeTranslatedSchema<T extends TranslationSchemaLike>(schema: T, langCode: string): T {
  const translations = getLanguageTranslations(schema.translations, langCode);
  if (!translations) {
    return schema;
  }

  const merged = JSON.parse(JSON.stringify(schema)) as T;

  merged.pages?.forEach((page) => {
    if (page.label && translations[page.label]) {
      page.label = translations[page.label];
    }

    page.sections?.forEach((section) => {
      if (section.label && translations[section.label]) {
        section.label = translations[section.label];
      }

      if (section.questions) {
        section.questions = section.questions.map((question) => handleMergeQuestion(question, translations));
      }
    });
  });

  return merged;
}

function handleExtractQuestion(question: FormField, translatableStrings: Record<string, string>) {
  if (question.label) {
    translatableStrings[question.label] = question.label;
  }

  question.questionOptions?.answers?.forEach((answer: QuestionAnswerOption) => {
    if (answer.label) {
      translatableStrings[answer.label] = answer.label;
    }
  });

  if (question.questionOptions?.rendering === 'markdown') {
    if (Array.isArray(question.value)) {
      question.value.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          translatableStrings[item] = item;
        }
      });
    } else if (typeof question.value === 'string' && question.value.trim()) {
      translatableStrings[question.value] = question.value;
    }
  }

  question.questions?.forEach((nestedQuestion) => {
    handleExtractQuestion(nestedQuestion, translatableStrings);
  });
}

function handleMergeQuestion(question: FormField, translations: Record<string, string>): FormField {
  if (question.label && translations[question.label]) {
    question.label = translations[question.label];
  }

  if (question.questionOptions?.answers) {
    question.questionOptions = {
      ...question.questionOptions,
      answers: question.questionOptions.answers.map((answer: QuestionAnswerOption) => ({
        ...answer,
        label: answer.label && translations[answer.label] ? translations[answer.label] : answer.label,
      })),
    };
  }

  if (question.questionOptions?.rendering === 'markdown') {
    if (Array.isArray(question.value)) {
      question.value = question.value.map((item) =>
        typeof item === 'string' && translations[item] ? translations[item] : item,
      );
    } else if (typeof question.value === 'string' && translations[question.value]) {
      question.value = translations[question.value];
    }
  }

  if (question.questions) {
    question.questions = question.questions.map((nestedQuestion) => handleMergeQuestion(nestedQuestion, translations));
  }

  return question;
}
