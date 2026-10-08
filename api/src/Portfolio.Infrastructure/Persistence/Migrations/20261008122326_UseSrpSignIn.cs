using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Portfolio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UseSrpSignIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "AdminAccounts");

            migrationBuilder.AddColumn<string>(
                name: "SrpSalt",
                table: "AdminAccounts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SrpVerifier",
                table: "AdminAccounts",
                type: "character varying(600)",
                maxLength: 600,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SrpSalt",
                table: "AdminAccounts");

            migrationBuilder.DropColumn(
                name: "SrpVerifier",
                table: "AdminAccounts");

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "AdminAccounts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }
    }
}
