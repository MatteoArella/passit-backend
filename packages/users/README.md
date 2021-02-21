# Users Service

Users service provides a REST API for retrieving users.

## Users API
The following OpenAPI specification describes the resources provided by the API:

```yaml
openapi: "3.0.1"
info:
  title: "UsersRestApi"
servers:
- url: "https://<UsersRestApiId>.execute-api.<AWSRegion>.amazonaws.com/{basePath}"
  variables:
    basePath:
      default: "/v1"
paths:
  /users/{userId}:
    get:
      operationId: "GetUserById"
      responses:
        "404":
          description: "404 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "200":
          description: "200 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
      security:
      - sigv4: []
components:
  schemas:
    User:
      required:
      - "createdAt"
      - "email"
      - "familyName"
      - "givenName"
      - "id"
      type: "object"
      properties:
        createdAt:
          type: "string"
          description: "the creation date of the user"
        phoneNumber:
          type: "string"
          description: "the phone number of the user"
        familyName:
          type: "string"
          description: "the family name of the user"
        givenName:
          type: "string"
          description: "the given name of the user"
        id:
          type: "string"
          description: "the ID of the user"
        birthDate:
          type: "string"
          description: "the birth date of the user"
        email:
          type: "string"
          description: "the email of the user"
        picture:
          type: "string"
          description: "the picture url of the user"
        updatedAt:
          type: "string"
          description: "the last modification date of the user"
    Error:
      title: "Error Schema"
      type: "object"
      properties:
        message:
          type: "string"
  securitySchemes:
    sigv4:
      type: "apiKey"
      name: "Authorization"
      in: "header"
      x-amazon-apigateway-authtype: "awsSigv4"
```

IAM Authorization is used for invoking the APIs.
