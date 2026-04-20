/*------------------------------------------------------------------------
    File        : LLM/OpenAIProvider.cls
    Purpose     : ILLMProvider implementation for OpenAI-compatible APIs.
                  Covers OpenAI, Azure OpenAI, Ollama, and any other
                  provider that implements the /chat/completions endpoint.
    Syntax      : LLM.OpenAIProvider
    Notes       : Uses System.Net.WebClient for synchronous HTTP calls,
                  avoiding async Task complexity in ABL .NET interop.
                  Uses Progress.Json.ObjectModel for response parsing.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.*                       FROM PROPATH.
USING Progress.Json.ObjectModel.* FROM PROPATH.
USING System.Net.WebClient        FROM ASSEMBLY.
USING System.Net.WebException     FROM ASSEMBLY.
USING System.IO.StreamReader      FROM ASSEMBLY.

CLASS LLM.OpenAIProvider IMPLEMENTS ILLMProvider:

    DEFINE PRIVATE VARIABLE cBaseUrl AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE cApiKey  AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE cModel   AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE oClient  AS WebClient  NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC OpenAIProvider(INPUT pcBaseUrl AS CHARACTER,
                                      INPUT pcApiKey  AS CHARACTER,
                                      INPUT pcModel   AS CHARACTER):
        cBaseUrl = pcBaseUrl.
        cApiKey  = pcApiKey.
        cModel   = pcModel.
        oClient  = NEW WebClient().
        oClient:Encoding = System.Text.Encoding:UTF8.
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER SendMessages(INPUT poMessages  AS LLMMessage EXTENT,
                                         INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cEndpoint AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE cBody     AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE cResponse AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE oParser   AS ObjectModelParser NO-UNDO.
        DEFINE VARIABLE oDoc      AS JsonObject        NO-UNDO.
        DEFINE VARIABLE oChoices  AS JsonArray         NO-UNDO.
        DEFINE VARIABLE oFirst    AS JsonObject        NO-UNDO.
        DEFINE VARIABLE oMsg      AS JsonObject        NO-UNDO.

        cEndpoint = TRIM(cBaseUrl, "/") + "/chat/completions".
        cBody     = THIS-OBJECT:BuildRequestBody(poMessages, piMaxTokens).

        oClient:Headers:Clear().
        oClient:Headers:Add("Content-Type", "application/json").
        oClient:Headers:Add("Authorization", "Bearer " + cApiKey).

        DO ON ERROR UNDO, THROW:
            cResponse = oClient:UploadString(cEndpoint, "POST", cBody).
            CATCH oEx AS WebException:
                DEFINE VARIABLE oErrReader AS StreamReader NO-UNDO.
                oErrReader = NEW StreamReader(oEx:Response:GetResponseStream()).
                UNDO, THROW NEW Progress.Lang.AppError(
                    SUBSTITUTE("OpenAI API error: &1", oErrReader:ReadToEnd()), 0).
            END CATCH.
        END.

        /* Parse: choices[0].message.content */
        oParser   = NEW ObjectModelParser().
        oDoc      = CAST(oParser:Parse(cResponse), JsonObject).
        oChoices  = CAST(oDoc:GetJsonArray("choices"), JsonArray).
        oFirst    = CAST(oChoices:GetJsonObject(1), JsonObject).
        oMsg      = CAST(oFirst:GetJsonObject("message"), JsonObject).
        cResponse = oMsg:GetCharacter("content").

        RETURN cResponse.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetLabel():
        RETURN SUBSTITUTE("OpenAI / &1", cModel).
    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER BuildRequestBody(INPUT poMessages  AS LLMMessage EXTENT,
                                              INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cJson AS CHARACTER NO-UNDO.
        DEFINE VARIABLE i     AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iLast AS INTEGER   NO-UNDO.

        iLast = EXTENT(poMessages).

        cJson = SUBSTITUTE('~{"model":"&1","max_tokens":&2,"messages":[',
                    cModel, piMaxTokens).

        DO i = 1 TO iLast:
            cJson = cJson +
                SUBSTITUTE('~{"role":"&1","content":"&2"~}',
                    poMessages[i]:Role,
                    THIS-OBJECT:EscapeJson(poMessages[i]:Content)).
            IF i < iLast THEN cJson = cJson + ",".
        END.

        cJson = cJson + "]}".

        RETURN cJson.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER EscapeJson(INPUT pcText AS CHARACTER):

        pcText = REPLACE(pcText, "~\",  "~\~\").
        pcText = REPLACE(pcText, '"',   '~\"').
        pcText = REPLACE(pcText, "~n",  "\n").
        pcText = REPLACE(pcText, "~r",  "\r").
        pcText = REPLACE(pcText, "~t",  "\t").

        RETURN pcText.

    END METHOD.

    /*--------------------------------------------------------------------*/

    DESTRUCTOR PUBLIC OpenAIProvider():
        IF VALID-OBJECT(oClient) THEN oClient:Dispose().
    END DESTRUCTOR.

END CLASS.
