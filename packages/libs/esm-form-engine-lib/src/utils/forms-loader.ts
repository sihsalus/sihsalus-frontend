import * as semver from 'semver';
import {
  type FormField,
  type FormIntentConfig,
  type FormSchema,
  type MarkdownConfig,
  type QuestionBehaviour,
} from '../types';

type FormRegistry = Record<string, Record<string, Record<string, FormSchema>>>;
type FormIntent = string | FormIntentConfig;

let baseRegistry: FormRegistry = {};
export interface FormJsonFile {
  version: string;
  semanticVersion?: string;
  json: FormSchema;
}

/**
 * This is a form behaviour property applied on `page` or `section` or `question`
 */
interface BehaviourProperty {
  name: string;
  type: 'field' | 'section' | 'page' | 'all';
  value: unknown;
}

/**
 * Convenience function for loading form(s) associated to a given package or form version.
 *
 * @param packageName The package associated with the form
 * @param formNamespace The form namespace
 * @param version The form version
 * @param isStrict If `true`, throws error if specified form version wasn't found
 * @param formsRegistry Form registry. (This was added for testing purposes)
 * @returns The form json
 */
export function getForm(
  packageName: string,
  formNamespace: string,
  version?: string,
  isStrict?: boolean,
  formsRegistry?: FormRegistry,
): FormSchema {
  const forms = lookupForms(packageName, formNamespace, formsRegistry);
  let form: FormJsonFile | null = null;
  if (version) {
    form = getFormByVersion(forms, version, isStrict);
  }
  if (!form) {
    form = getLatestFormVersion(forms);
  }
  return loadSubforms(form.json);
}

export function loadSubforms(parentForm: FormSchema): FormSchema {
  parentForm.pages = parentForm.pages || [];
  parentForm.pages.forEach((page) => {
    if (page.isSubform && page.subform?.name && page.subform.package) {
      try {
        const subform = getForm(page.subform.package, page.subform.name);
        if (!subform) {
          console.error(`Form with name "${page.subform.package}/${page.subform.name}" was not found in registry.`);
        }
        page.subform.form = subform;
      } catch (error) {
        console.error(error);
      }
    }
  });
  return parentForm;
}

export function getLatestFormVersion(forms: FormJsonFile[]): FormJsonFile {
  if (forms.length === 1) {
    return forms[0];
  }
  const candidates = forms.map((f) => f.semanticVersion).filter((v): v is string => Boolean(v));
  const latest = candidates.sort(formsVersionComparator)[candidates.length - 1];
  return forms.find((f) => f.semanticVersion === latest) ?? forms[0];
}

export function getFormByVersion(
  forms: FormJsonFile[],
  requiredVersion: string,
  isStrict?: boolean,
): FormJsonFile | null {
  for (const form of forms) {
    if (form.semanticVersion && semver.satisfies(form.semanticVersion, requiredVersion)) {
      return form;
    }
  }
  if (isStrict) {
    throw new Error(`Couldn't find form with version: ${requiredVersion}`);
  } else {
    return null;
  }
}

export function lookupForms(packageName: string, formNamespace: string, formsRegistry?: FormRegistry): FormJsonFile[] {
  const pkg = formsRegistry ? formsRegistry[packageName] : baseRegistry[packageName];
  if (!pkg) {
    throw Error(`Package with name ${packageName} was not found in registry`);
  }
  if (!pkg[formNamespace]) {
    throw new Error(`Form namespace '${formNamespace}' was not found in forms registry`);
  }
  return Object.keys(pkg[formNamespace]).map((formVersion) => {
    return {
      version: formVersion,
      semanticVersion: semver.coerce(formVersion)?.version,
      json: pkg[formNamespace][formVersion],
    };
  });
}

/**
 * Function parses JSON form input and filters validation behaviours according to a given intent
 *
 * @param {string} intent The specified intent
 * @param {object} originalJson The original JSON form schema object
 * @param parentOverrides An array of behaviour overrides from parent form to be applied to a subform
 * @returns {object} The form json
 */
export function applyFormIntent(
  intent: FormIntent | undefined,
  originalJson: FormSchema,
  parentOverrides?: Array<BehaviourProperty>,
): FormSchema {
  if (!intent) {
    return originalJson;
  }
  const jsonBuffer = structuredClone(originalJson);
  const resolvedIntent = getIntentName(intent);
  // Set the default page based on the current intent
  if (jsonBuffer.availableIntents) {
    const defaultPageConfig = jsonBuffer.availableIntents.find(
      (candidate) => getIntentName(candidate) === resolvedIntent,
    );
    jsonBuffer.defaultPage =
      defaultPageConfig && typeof defaultPageConfig !== 'string' ? defaultPageConfig.defaultPage : undefined;
  }

  // filter form-level markdown behaviour
  if (jsonBuffer.markdown) {
    updateMarkdownRequiredBehaviour(jsonBuffer.markdown, intent);
  }

  // Before starting traversal, ensure nodes exist, at least as empty-arrays
  jsonBuffer.pages = jsonBuffer.pages || [];

  // Traverse the property tree with items of interest for validation
  jsonBuffer.pages.forEach((page) => {
    if (page.isSubform && page.subform?.form) {
      const behaviourOverrides: Array<BehaviourProperty> = [];
      const targetBehaviour = page.subform.behaviours?.find((behaviour) => behaviour.intent === resolvedIntent);
      if (targetBehaviour?.readonly !== undefined && targetBehaviour?.readonly != null) {
        behaviourOverrides.push({ name: 'readonly', type: 'field', value: targetBehaviour?.readonly });
      }

      page.subform.form = applyFormIntent(
        targetBehaviour?.subform_intent || '*',
        page.subform?.form,
        behaviourOverrides,
      );
    }
    const pageBehaviour = page.behaviours?.find((behaviour) => behaviour.intent === resolvedIntent);
    if (pageBehaviour) {
      page.hide = pageBehaviour.hide ?? page.hide;
      page.readonly = pageBehaviour.readonly ?? page.readonly;
    } else {
      const fallBackBehaviour = page.behaviours?.find((behaviour) => behaviour.intent === '*');
      if (fallBackBehaviour) {
        page.hide = fallBackBehaviour.hide ?? page.hide;
        page.readonly = fallBackBehaviour.readonly ?? page.readonly;
      }
    }

    // filter page-level markdown behaviour
    if (page.markdown) {
      updateMarkdownRequiredBehaviour(page.markdown, intent);
    }
    // Before starting traversal, ensure nodes exist, at least as empty-arrays
    page.sections = page.sections || [];

    page.sections.forEach((section) => {
      const secBehaviour = section.behaviours?.find((behaviour) => behaviour.intent === resolvedIntent);
      if (secBehaviour) {
        section.hide = secBehaviour.hide ?? section.hide;
      } else {
        const fallBackBehaviour = section.behaviours?.find((behaviour) => behaviour.intent === '*');
        section.hide = fallBackBehaviour?.hide ?? section.hide;
      }

      // filter section-level markdown behaviour
      if (section.markdown) {
        updateMarkdownRequiredBehaviour(section.markdown, intent);
      }

      // Before starting traversal, ensure nodes exist, at least as empty-arrays
      section.questions = section.questions || [];

      section.questions.forEach((question: FormField) => {
        if (question['behaviours']) {
          updateQuestionRequiredBehaviour(question, resolvedIntent);
          parentOverrides
            ?.filter((override) => override.type === 'all' || override.type === 'field')
            ?.forEach((override) => {
              applyOverride(question, override);
            });
        }

        if (question.questions && question.questions.length) {
          question.questions.forEach((childQuestion) => {
            updateQuestionRequiredBehaviour(childQuestion, resolvedIntent);

            parentOverrides
              ?.filter((override) => override.type === 'all' || override.type === 'field')
              ?.forEach((override) => {
                applyOverride(childQuestion, override);
              });
          });
        }
      });
    });
  });
  return jsonBuffer;
}

// Helpers

function updateQuestionRequiredBehaviour(question: FormField, intent: string): void {
  const requiredIntentBehaviour = question.behaviours?.find((behaviour) => behaviour.intent === intent);

  const defaultIntentBehaviour = question.behaviours?.find((behaviour) => behaviour.intent === '*');
  // If both required and default intents exist, combine them and update to question
  if (requiredIntentBehaviour || defaultIntentBehaviour) {
    // Remove the intent name props from each object
    const requiredBehaviour = requiredIntentBehaviour ? { ...requiredIntentBehaviour } : undefined;
    const fallbackBehaviour = defaultIntentBehaviour ? { ...defaultIntentBehaviour } : undefined;
    delete requiredBehaviour?.intent;
    delete fallbackBehaviour?.intent;

    // Combine required and default intents following the rules:
    // 1. The default intent is applied to all other intents
    // 2. Intent-specific behaviour overrides default behaviour
    const combinedBehaviours = Object.assign(fallbackBehaviour || {}, requiredBehaviour || {}) as QuestionBehaviour;
    const defaultValue = combinedBehaviours.defaultValue;
    if (defaultValue !== undefined) {
      // add the default value under the question options
      question.questionOptions.defaultValue = defaultValue;
      // delete it so that it's not added at the root level of the question
      delete combinedBehaviours.defaultValue;
    }
    // Add the combinedBehaviours data to initial question
    Object.assign(question, combinedBehaviours);
    // Remove behaviours list
    delete question.behaviours;
  }
}

function updateMarkdownRequiredBehaviour(markdown: MarkdownConfig, intent: FormIntent): void {
  const resolvedIntent = getIntentName(intent);
  const requiredIntentBehaviour = markdown.behaviours?.find((behaviour) => behaviour.intent === resolvedIntent);
  const defaultIntentBehaviour = markdown.behaviours?.find((behaviour) => behaviour.intent === '*');

  if (requiredIntentBehaviour && defaultIntentBehaviour) {
    const requiredBehaviour = { ...requiredIntentBehaviour };
    const fallbackBehaviour = { ...defaultIntentBehaviour };
    delete requiredBehaviour.intent;
    delete fallbackBehaviour.intent;
    const combinedBehaviours = Object.assign(fallbackBehaviour, requiredBehaviour);

    Object.assign(markdown, combinedBehaviours);
    delete markdown.behaviours;
  } else if (!requiredIntentBehaviour && defaultIntentBehaviour) {
    const fallbackBehaviour = { ...defaultIntentBehaviour };
    delete fallbackBehaviour.intent;

    Object.assign(markdown, fallbackBehaviour);
    delete markdown.behaviours;
  }
}

export function updateExcludeIntentBehaviour(excludedIntents: Array<string>, originalJson: FormSchema): FormSchema {
  originalJson.availableIntents = (originalJson.availableIntents ?? []).filter(
    (intent) => !excludedIntents.includes(getIntentName(intent)),
  );
  return originalJson;
}

export function addToBaseFormsRegistry(customRegistry: FormRegistry): void {
  baseRegistry = { ...baseRegistry, ...customRegistry };
}

function isPositiveInteger(x: string): boolean {
  return /^\d+$/.test(x);
}

function formsVersionComparator(v1: string, v2: string): number {
  const v1parts = v1.split('.');
  const v2parts = v2.split('.');
  // First, validate both numbers are true version numbers
  function validateParts(parts: Array<string>): boolean {
    for (let i = 0; i < parts.length; ++i) {
      if (!isPositiveInteger(parts[i])) {
        return false;
      }
    }
    return true;
  }
  if (!validateParts(v1parts) || !validateParts(v2parts)) {
    return NaN;
  }
  for (let i = 0; i < v1parts.length; ++i) {
    if (v2parts.length === i) {
      return 1;
    }
    if (v1parts[i] === v2parts[i]) {
      continue;
    }
    if (v1parts[i] > v2parts[i]) {
      return 1;
    }
    return -1;
  }
  if (v1parts.length !== v2parts.length) {
    return -1;
  }
  return 0;
}

function getIntentName(intent: FormIntent): string {
  return typeof intent === 'string' ? intent : intent.intent;
}

function applyOverride(question: FormField, override: BehaviourProperty): void {
  Object.assign(question, { [override.name]: override.value });
}
