using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Portfolio.Api.Options;

namespace Portfolio.Api.Services;

/// <summary>Uploads images to Cloudflare R2 (S3-compatible) and returns their public URL.</summary>
public sealed class MediaStorage(IOptions<R2Options> options) : IDisposable
{
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly Dictionary<string, string> Extensions = new()
    {
        ["image/png"] = "png",
        ["image/jpeg"] = "jpg",
        ["image/webp"] = "webp",
        ["image/gif"] = "gif",
    };

    private readonly Lazy<IAmazonS3> client = new(() =>
    {
        var o = options.Value;
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{o.AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true,
            AuthenticationRegion = "auto",
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };
        return new AmazonS3Client(new BasicAWSCredentials(o.AccessKeyId, o.SecretAccessKey), config);
    });

    public bool IsConfigured => options.Value.IsConfigured;

    public static bool IsAllowedType(string contentType) => Extensions.ContainsKey(contentType);

    /// <summary>Checks the file's first bytes, so a renamed non-image is rejected.</summary>
    public static bool LooksLikeImage(ReadOnlySpan<byte> head, string contentType) => contentType switch
    {
        "image/png" => head.Length >= 8 && head[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        "image/jpeg" => head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF,
        "image/gif" => head.Length >= 6 && (head[..6].SequenceEqual("GIF87a"u8) || head[..6].SequenceEqual("GIF89a"u8)),
        "image/webp" => head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head[8..12].SequenceEqual("WEBP"u8),
        _ => false,
    };

    public async Task<string> UploadAsync(Stream data, string contentType, CancellationToken ct)
    {
        var o = options.Value;
        var key = $"uploads/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}.{Extensions[contentType]}";
        await client.Value.PutObjectAsync(new PutObjectRequest
        {
            BucketName = o.Bucket,
            Key = key,
            InputStream = data,
            ContentType = contentType,
            DisablePayloadSigning = true,
            Headers = { CacheControl = "public, max-age=31536000, immutable" },
        }, ct);
        return $"{o.PublicBaseUrl.TrimEnd('/')}/{key}";
    }

    public void Dispose()
    {
        if (client.IsValueCreated) client.Value.Dispose();
    }
}
