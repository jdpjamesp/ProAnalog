/*------------------------------------------------------------------------
    File        : LLM/AnthropicProvider.cls
    Purpose     : ILLMProvider implementation for the Anthropic Messages
                  API (Claude models).
    Syntax      : LLM.AnthropicProvider
    Notes       : Key differences from OpenAI:
                    - Auth: x-api-key header + anthropic-version header
                    - System prompt is a top-level field, not a message
                    - Response path: content[0].text
                    - max_tokens is required
                  Uses System.Net.WebClient for synchronous HTTP calls,
                  avoiding async Task complexity in ABL .NET interop.
                  Uses Progress.Json.ObjectModel for response parsing.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING LLM.*                       FROM PROPATH.
USING Progress.Json.ObjectModel.* FROM PROPATH.
USING System.Net.WebClient        FROM ASSEMBLY.
USING System.Net.WebException     FROM ASSEMBLY.
USING System.IO.StreamReader      FROM ASSEMBLY.

CLASS LLM.AnthropicProvider IMPLEMENTS ILLMProvider:

    DEFINE PRIVATE STATIC VARIABLE ANTHROPIC-VERSION AS CHARACTER
        INITIAL "2023-06-01" NO-UNDO.

    DEFINE PRIVATE VARIABLE cBaseUrl AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE cApiKey  AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE cModel   AS CHARACTER  NO-UNDO.
    DEFINE PRIVATE VARIABLE oClient  AS WebClient  NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC AnthropicProvider(INPUT pcBaseUrl AS CHARACTER,
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

        DEFINE VARIABLE cEndpoint    AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE cBody        AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE cResponse    AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE oParser      AS ObjectModelParser NO-UNDO.
        DEFINE VARIABLE oDoc         AS JsonObject        NO-UNDO.
        DEFINE VARIABLE oContentArr  AS JsonArray         NO-UNDO.
        DEFINE VARIABLE oFirst       AS JsonObject        NO-UNDO.

        cEndpoint = TRIM(cBaseUrl, "/") + "/messages".
        cBody     = THIS-OBJECT:BuildRequestBody(poMessages, piMaxTokens).

        oClient:Headers:Clear().
        oClient:Headers:Add("Content-Type",      "application/json").
        oClient:Headers:Add("x-api-key",         cApiKey).
        oClient:Headers:Add("anthropic-version",  ANTHROPIC-VERSION).

        DO ON ERROR UNDO, THROW:
            cResponse = oClient:UploadString(cEndpoint, "POST", cBody).
            CATCH oEx AS WebException:
                DEFINE VARIABLE oErrReader AS StreamReader NO-UNDO.
                oErrReader = NEW StreamReader(oEx:Response:GetResponseStream()).
                UNDO, THROW NEW Progress.Lang.AppError(
                    SUBSTITUTE("Anthropic API error: &1", oErrReader:ReadToEnd()), 0).
            END CATCH.
        END.

        /* Parse: content[0].text */
        oParser     = NEW ObjectModelParser().
        oDoc        = CAST(oParser:Parse(cResponse), JsonObject).
        oContentArr = CAST(oDoc:GetJsonArray("content"), JsonArray).
        oFirst      = CAST(oContentArr:GetJsonObject(1), JsonObject).
        cResponse   = oFirst:GetCharacter("text").

        RETURN cResponse.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetLabel():
        RETURN SUBSTITUTE("Anthropic / &1", cModel).
    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Anthropic keeps the system prompt as a top-level field; only       */
    /* user/assistant messages go in the messages array.                  */
    /*--------------------------------------------------------------------*/

    METHOD PRIVATE CHARACTER BuildRequestBody(INPUT poMessages  AS LLMMessage EXTENT,
                                              INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cJson     AS CHARACTER NO-UNDO.
        DEFINE VARIABLE cSystem   AS CHARACTER NO-UNDO.
        DEFINE VARIABLE i         AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iLast     AS INTEGER   NO-UNDO.
        DEFINE VARIABLE lFirstMsg AS LOGICAL   NO-UNDO INITIAL TRUE.

        iLast = EXTENT(poMessages).

        DO i = 1 TO iLast:
            IF poMessages[i]:Role = "system" THEN DO:
                cSystem = THIS-OBJECT:EscapeJson(poMessages[i]:Content).
                LEAVE.
            END.
        END.

        cJson = SUBSTITUTE('~{"model":"&1","max_tokens":&2,"system":"&3","messages":[',
                    cModel, piMaxTokens, cSystem).

        DO i = 1 TO iLast:
            IF poMessages[i]:Role = "system" THEN NEXT.

            IF NOT lFirstMsg THEN cJson = cJson + ",".
            cJson = cJson +
                SUBSTITUTE('~{"role":"&1","content":"&2"~}',
                    poMessages[i]:Role,
                    THIS-OBJECT:EscapeJson(poMessages[i]:Content)).
            lFirstMsg = FALSE.
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

    DESTRUCTOR PUBLIC AnthropicProvider():
        IF VALID-OBJECT(oClient) THEN oClient:Dispose().
    END DESTRUCTOR.

END CLASS.
