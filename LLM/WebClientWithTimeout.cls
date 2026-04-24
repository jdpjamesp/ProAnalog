/*------------------------------------------------------------------------
    File        : LLM/WebClientWithTimeout.cls
    Purpose     : Extends System.Net.WebClient to set a configurable timeout
                  on the underlying HttpWebRequest. The base WebClient class
                  does not expose a Timeout property directly, so we override
                  GetWebRequest to inject the timeout.
    Syntax      : LLM.WebClientWithTimeout
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING System.Net.WebClient       FROM ASSEMBLY.
USING System.Net.WebRequest      FROM ASSEMBLY.
USING System.Net.HttpWebRequest  FROM ASSEMBLY.

CLASS LLM.WebClientWithTimeout INHERITS WebClient:

    DEFINE PRIVATE VARIABLE iTimeoutMs AS INTEGER NO-UNDO.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC WebClientWithTimeout(INPUT piTimeoutSeconds AS INTEGER):
        iTimeoutMs = piTimeoutSeconds * 1000.
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/
    /* Override to set timeout on the underlying HttpWebRequest          */
    /*--------------------------------------------------------------------*/

    METHOD OVERRIDE PROTECTED WebRequest GetWebRequest(
            INPUT poUri AS System.Uri):

        DEFINE VARIABLE oRequest AS WebRequest      NO-UNDO.
        DEFINE VARIABLE oHttpReq AS HttpWebRequest  NO-UNDO.

        oRequest = SUPER:GetWebRequest(poUri).

        IF VALID-OBJECT(oRequest) AND
           oRequest:GetType():Name = "HttpWebRequest" THEN DO:
            oHttpReq = CAST(oRequest, HttpWebRequest).
            oHttpReq:Timeout = iTimeoutMs.
        END.

        RETURN oRequest.

    END METHOD.

END CLASS.
