import { fileURLToPath } from 'node:url'
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import { CfnStage, HttpApi } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

export interface ApiStackProps extends StackProps {
  /** Version de l'API (api/package.json), renvoyée par /health. */
  version: string
  /** Commit déployé, renvoyé par /health. */
  gitSha: string
  /** Origines autorisées (CORS), séparées par des virgules. */
  corsOrigin: string
  /** Paramètre SSM (SecureString) contenant l'URL Supabase. */
  databaseUrlParameter: string
}

/** Paquet construit par `npm --prefix api run build:lambda`. */
const LAMBDA_BUNDLE = fileURLToPath(
  new URL('../../api/dist-lambda', import.meta.url),
)

/**
 * API Hono sur AWS : API Gateway (HTTP API) -> Lambda -> Supabase.
 * Le CORS est géré par Hono (pas par API Gateway, sinon en-têtes en double).
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const logGroup = new LogGroup(this, 'ApiLogs', {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const fn = new Function(this, 'ApiFunction', {
      description: 'API Hono : liste de Pokémon à capturer',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      handler: 'index.handler',
      code: Code.fromAsset(LAMBDA_BUNDLE),
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        APP_VERSION: props.version,
        GIT_SHA: props.gitSha,
        CORS_ORIGIN: props.corsOrigin,
        DATABASE_URL_PARAMETER: props.databaseUrlParameter,
      },
    })

    // Droit de lire ce seul paramètre (la clé KMS aws/ssm l'autorise via SSM).
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          Stack.of(this).formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: props.databaseUrlParameter.replace(/^\//, ''),
          }),
        ],
      }),
    )

    const api = new HttpApi(this, 'HttpApi', {
      apiName: 'pokemon-api',
      description: 'API Hono : liste de Pokémon à capturer',
      defaultIntegration: new HttpLambdaIntegration('Hono', fn),
    })

    // Limite de débit : protège la facture et le pooler Supabase.
    const stage = api.defaultStage?.node.defaultChild as CfnStage
    stage.defaultRouteSettings = {
      throttlingRateLimit: 20,
      throttlingBurstLimit: 40,
    }

    new CfnOutput(this, 'ApiUrl', {
      description: 'URL publique de l’API',
      value: api.apiEndpoint,
    })
    new CfnOutput(this, 'FunctionName', { value: fn.functionName })
  }
}
