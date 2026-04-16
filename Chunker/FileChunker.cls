/*------------------------------------------------------------------------
    File        : Chunker/FileChunker.cls
    Purpose     : Reads a text file and splits it into chunks that do not
                  exceed a configured character limit, always splitting on
                  a line boundary so log entries are never cut mid-line.
    Syntax      : Chunker.FileChunker
    Notes       : ChunkSizeChars is used as a proxy for token count.
                  A rough rule of thumb is ~4 characters per token, so
                  the default of 80,000 chars ~ 20,000 tokens.
  ----------------------------------------------------------------------*/

BLOCK-LEVEL ON ERROR UNDO, THROW.

USING System.IO.StreamReader FROM ASSEMBLY.
USING System.Text.StringBuilder FROM ASSEMBLY.

CLASS Chunker.FileChunker:

    DEFINE PUBLIC PROPERTY ChunkSizeChars AS INTEGER NO-UNDO
        GET. SET.

    DEFINE PRIVATE TEMP-TABLE ttChunk NO-UNDO
        FIELD iSeq    AS INTEGER
        FIELD cContent AS CHARACTER
        INDEX ixSeq IS PRIMARY UNIQUE iSeq.

    /*--------------------------------------------------------------------*/

    CONSTRUCTOR PUBLIC FileChunker(INPUT piChunkSizeChars AS INTEGER):
        ChunkSizeChars = piChunkSizeChars.
    END CONSTRUCTOR.

    /*--------------------------------------------------------------------*/
    /* Splits pcFilePath into chunks. Returns the number of chunks.      */
    /* Retrieve each chunk via GetChunk(i).                               */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC INTEGER ChunkFile(INPUT pcFilePath AS CHARACTER):

        DEFINE VARIABLE oReader  AS StreamReader   NO-UNDO.
        DEFINE VARIABLE oBuilder AS StringBuilder  NO-UNDO.
        DEFINE VARIABLE cLine    AS CHARACTER      NO-UNDO.
        DEFINE VARIABLE iSeq     AS INTEGER        NO-UNDO.

        IF NOT System.IO.File:Exists(pcFilePath) THEN
            UNDO, THROW NEW Progress.Lang.AppError(
                SUBSTITUTE("File not found: &1", pcFilePath), 0).

        EMPTY TEMP-TABLE ttChunk.
        iSeq     = 0.
        oBuilder = NEW StringBuilder().
        oReader  = NEW StreamReader(pcFilePath).

        DO WHILE NOT oReader:EndOfStream:
            cLine = oReader:ReadLine().

            /* +1 for the newline we will add */
            IF oBuilder:Length > 0 AND
               (oBuilder:Length + LENGTH(cLine) + 1) > ChunkSizeChars THEN DO:

                /* Save current chunk and start a new one */
                iSeq = iSeq + 1.
                CREATE ttChunk.
                ASSIGN
                    ttChunk.iSeq     = iSeq
                    ttChunk.cContent = oBuilder:ToString().
                oBuilder = NEW StringBuilder().
            END.

            oBuilder:AppendLine(cLine).
        END.

        /* Flush the final chunk */
        IF oBuilder:Length > 0 THEN DO:
            iSeq = iSeq + 1.
            CREATE ttChunk.
            ASSIGN
                ttChunk.iSeq     = iSeq
                ttChunk.cContent = oBuilder:ToString().
        END.

        oReader:Close().
        oReader:Dispose().

        RETURN iSeq.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Returns the content of chunk number piSeq (1-based).              */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC CHARACTER GetChunk(INPUT piSeq AS INTEGER):

        FIND FIRST ttChunk WHERE ttChunk.iSeq = piSeq NO-LOCK NO-ERROR.
        IF AVAILABLE ttChunk THEN
            RETURN ttChunk.cContent.

        RETURN "".

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Returns the total number of chunks from the last ChunkFile() call. */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC INTEGER ChunkCount():

        DEFINE VARIABLE i AS INTEGER NO-UNDO.
        FOR EACH ttChunk NO-LOCK: i = i + 1. END.
        RETURN i.

    END METHOD.

    /*--------------------------------------------------------------------*/
    /* Returns TRUE if the file fits in a single chunk.                   */
    /*--------------------------------------------------------------------*/

    METHOD PUBLIC LOGICAL NeedsChunking(INPUT pcFilePath AS CHARACTER):

        DEFINE VARIABLE oInfo AS System.IO.FileInfo NO-UNDO.

        oInfo = NEW System.IO.FileInfo(pcFilePath).
        RETURN (oInfo:Length > ChunkSizeChars).

    END METHOD.

END CLASS.
