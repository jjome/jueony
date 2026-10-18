# Retained unequal-column storage regression: failing baseline151

The committed verifier uses the original two fixed fixture byte hashes.
Actual edits, scalar/UTF16 body coverage, five retained mixed-format disk
reopens, two tail-edit exports, undo/redo, wrong-password refusal and the
unchanged production semantic/whole-layout guard are required.

Official151 fails all16 cases;12 intermediate disk exports succeeded before
failure. These are failing baseline artifacts, not completed implementation.
The final candidate must run the same verifier and four clean guard bytes,
then produce16 passes,112 exports,32 history pairs and56 password refusals.
The static audit records its limits; it is not a new runtime test execution.

Run `python verify.py` here to check the frozen bytes. Compressed artifacts
are deterministic gzip. The original fixtures remain in the existing fixed
fixture directory and are not regenerated. Hancom comparison is deferred.
