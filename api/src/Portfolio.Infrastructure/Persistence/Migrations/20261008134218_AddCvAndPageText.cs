using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Portfolio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCvAndPageText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "CvBullets",
                table: "Projects",
                type: "text[]",
                nullable: false,
                // Existing projects start with no CV bullets (hand-added: EF leaves array columns without a default).
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<bool>(
                name: "HideFromCv",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HideFromCv",
                table: "Experiences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ContentDocuments",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Json = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentDocuments", x => x.Key);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentDocuments");

            migrationBuilder.DropColumn(
                name: "CvBullets",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "HideFromCv",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "HideFromCv",
                table: "Experiences");
        }
    }
}
