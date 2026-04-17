/*------------------------------------------------------------------------
    File        : LLM/LLMProviderFactory.cls
    Purpose     : Reads the provider field from AppConfig and returns the
                  appropriate ILLMProvider implementation.
                  Adding a new provider means adding a class and one WHEN
                  branch here — nothing else changes.
    Syntax      : LLM.LLMProviderFactory
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.ILLMProvider       FROM PROPATH.
USING LLM.OpenAIProvider     FROM PROPATH.
USING LLM.AnthropicProvider  FROM PROPATH.
USING Config.AppConfig        FROM PROPATH.

CLASS LLM.LLMProviderFactory:

    METHOD PUBLIC STATIC ILLMProvider Create(INPUT poConfig AS AppConfig):

        DEFINE VARIABLE cProvider AS CHARACTER NO-UNDO.

        cProvider = LOWER(TRIM(poConfig:Provider)).

        CASE cProvider:
            WHEN "openai" OR WHEN "azure" OR WHEN "ollama" OR WHEN "openai-compatible" THEN
                RETURN NEW OpenAIProvider(
                    poConfig:BaseUrl,
                    poConfig:ApiKey,
                    poConfig:Model).

            WHEN "anthropic" THEN
                RETURN NEW AnthropicProvider(
                    poConfig:BaseUrl,
                    poConfig:ApiKey,
                    poConfig:Model).

            OTHERWISE
                UNDO, THROW NEW Progress.Lang.AppError(
                    SUBSTITUTE("Unknown LLM provider '&1'. Valid values are: openai, azure, ollama, openai-compatible, anthropic.", cProvider), 0).
        END CASE.

    END METHOD.

END CLASS.
