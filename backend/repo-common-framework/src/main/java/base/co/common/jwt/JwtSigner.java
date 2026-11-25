package base.co.common.jwt;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;

import java.security.interfaces.RSAPrivateKey;

public final class JwtSigner {
    private JwtSigner() {
    }

    public static String sign(JWTClaimsSet claims, RSAPrivateKey privateKey) {
        try {
            SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
            signedJWT.sign(new RSASSASigner(privateKey));
            return signedJWT.serialize();
        } catch (JOSEException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to sign JWT", e);
        }
    }

    public static String sign(JWTClaimsSet claims, RSAPrivateKey privateKey, String keyId) {
        try {
            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
                    .keyID(keyId)
                    .build();
            SignedJWT signedJWT = new SignedJWT(header, claims);
            signedJWT.sign(new RSASSASigner(privateKey));
            return signedJWT.serialize();
        } catch (JOSEException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to sign JWT", e);
        }
    }
}
