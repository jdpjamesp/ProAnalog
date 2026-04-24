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
    DEFINE PRIVATE VARIABLE iTimeout AS INTEGER    NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC OpenAIProvider(INPUT pcBaseUrl AS CHARACTER,
                                      INPUT pcApiKey  AS CHARACTER,
                                      INPUT pcModel   AS CHARACTER,
                                      INPUT piTimeoutSeconds AS INTEGER):
        cBaseUrl = pcBaseUrl.
        cApiKey  = pcApiKey.
        cModel   = pcModel.
        iTimeout = piTimeoutSeconds.
        oClient  = NEW WebClientWithTimeout(piTimeoutSeconds).
        oClient:Encoding = System.Text.Encoding:UTF8.
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER SendMessages(INPUT poMessages  AS LLMMessage EXTENT,
                                         INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cEndpoint AS CHARACTER         NO-UNDO.
        DEFINE VARIABLE cBody     AS LONGCHAR          NO-UNDO.
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
                DEFINE VARIABLE oErrReader  AS StreamReader                   NO-UNDO.
                DEFINE VARIABLE oHttpResp   AS System.Net.HttpWebResponse     NO-UNDO.
                DEFINE VARIABLE cErrBody    AS CHARACTER                      NO-UNDO.
                DEFINE VARIABLE cStatus     AS CHARACTER                      NO-UNDO.
                DEFINE VARIABLE cMessage    AS CHARACTER                      NO-UNDO.

                /* Check if this is a timeout */
                IF oEx:Status = System.Net.WebExceptionStatus:Timeout OR
                   oEx:InnerException:GetType():Name = "OperationCanceledException" THEN
                    cMessage = SUBSTITUTE(
                        "OpenAI API request timed out after &1 seconds. " +
                        "Consider increasing timeoutSeconds in proanalog.json or checking your connection.",
                        iTimeout).
                ELSE DO:
                    IF VALID-OBJECT(oEx:Response) THEN DO:
                        oHttpResp  = CAST(oEx:Response, System.Net.HttpWebResponse).
                        cStatus    = oHttpResp:StatusDescription.
                        oErrReader = NEW StreamReader(oEx:Response:GetResponseStream()).
                        cErrBody   = oErrReader:ReadToEnd().
                    END.
                    ELSE
                        cStatus = oEx:Message.
                    cMessage = "OpenAI API error [" + cStatus + "]: " + cErrBody.
                END.

                UNDO, THROW NEW Progress.Lang.AppError(cMessage, 0).
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

    METHOD PRIVATE LONGCHAR BuildRequestBody(INPUT poMessages  AS LLMMessage EXTENT,
                                             INPUT piMaxTokens AS INTEGER):

        DEFINE VARIABLE cJson AS LONGCHAR  NO-UNDO.
        DEFINE VARIABLE i     AS INTEGER   NO-UNDO.
        DEFINE VARIABLE iLast AS INTEGER   NO-UNDO.

        iLast = EXTENT(poMessages).

        cJson = SUBSTITUTE('~{"model":"&1","max_tokens":&2,"messages":[',
                    cModel, piMaxTokens).

        DO i = 1 TO iLast:
            cJson = cJson +
                '~{"role":"' + poMessages[i]:Role + '","content":"' +
                THIS-OBJECT:EscapeJson(poMessages[i]:Content) + '"~}'.
            IF i < iLast THEN cJson = cJson + ",".
        END.

        cJson = cJson + "]}".

        RETURN cJson.

    END METHOD.

    /*--------------------------------------------------------------------*/

    METHOD PRIVATE LONGCHAR EscapeJson(INPUT pcText AS LONGCHAR):

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
