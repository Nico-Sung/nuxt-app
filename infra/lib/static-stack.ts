import { fileURLToPath } from 'node:url'
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import {
  Distribution,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  Function as CloudFrontFunction,
  HttpVersion,
  PriceClass,
  ViewerProtocolPolicy,
  CachePolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import {
  OidcProviderNative,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam'
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

export interface StaticStackProps extends StackProps {
  /** Dépôt GitHub autorisé à déployer : "Nico-Sung/nuxt-app". */
  githubRepository: string
  /** Environnement GitHub du job de déploiement (le seul autorisé). */
  githubEnvironment: string
}

const URL_REWRITE = fileURLToPath(
  new URL('../functions/url-rewrite.js', import.meta.url),
)

/**
 * Site statique (nuxt generate) : S3 privé -> CloudFront (OAC).
 * GitHub Actions déploie avec un rôle IAM obtenu par OIDC (aucune clé stockée).
 */
export class StaticStack extends Stack {
  constructor(scope: Construct, id: string, props: StaticStackProps) {
    super(scope, id, props)

    // Privé : seul CloudFront peut lire (Origin Access Control).
    // Supprimer la stack exige de vider le bucket avant (pas de Lambda de nettoyage).
    const bucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // /pokemon/pikachu -> /pokemon/pikachu/index.html
    const urlRewrite = new CloudFrontFunction(this, 'UrlRewrite', {
      runtime: FunctionRuntime.JS_2_0,
      comment: 'Ajoute index.html aux URL de pages',
      code: FunctionCode.fromFile({ filePath: URL_REWRITE }),
    })

    const distribution = new Distribution(this, 'SiteDistribution', {
      comment: 'Pokemon a capturer (site statique)',
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_100,
      httpVersion: HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Respecte le Cache-Control posé par le workflow (1 an pour _nuxt/, 0 pour le HTML).
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          { function: urlRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      // Fichier absent (S3 répond 403 sans droit de lister) : page 404 de Nuxt,
      // qui affiche « Pokémon introuvable » ; vrai statut 404.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: Duration.seconds(10),
      })),
    })

    // GitHub Actions -> AWS sans clé : jeton OIDC échangé contre un rôle temporaire.
    const github = new OidcProviderNative(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    })

    const deployRole = new Role(this, 'DeployRole', {
      roleName: 'pokemon-static-deploy',
      description: 'GitHub Actions : sync S3 + invalidation CloudFront',
      maxSessionDuration: Duration.hours(1),
      assumedBy: new WebIdentityPrincipal(
        github.oidcProviderArn,
      ).withConditions({
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          // uniquement ce dépôt, et uniquement le job de l'environnement de déploiement
          'token.actions.githubusercontent.com:sub': `repo:${props.githubRepository}:environment:${props.githubEnvironment}`,
        },
      }),
    })

    deployRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
      }),
    )
    deployRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
        resources: [bucket.arnForObjects('*')],
      }),
    )
    deployRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'cloudfront:CreateInvalidation',
          'cloudfront:GetInvalidation',
        ],
        resources: [
          Stack.of(this).formatArn({
            service: 'cloudfront',
            region: '',
            resource: 'distribution',
            resourceName: distribution.distributionId,
          }),
        ],
      }),
    )

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
    })
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
    })
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn })
  }
}
